/**
 * Parche del workflow n8n: Historial del Chatbot (PC07)
 *
 * Aplica sobre n8n/workflows/peluqueria_carolina_cloud.json:
 *   1. "Validar Payload5": agrega session_id, canal y timestamp_iso (hora exacta de recepción).
 *   2. "Consultar Gemini": salida estructurada JSON { respuesta, categorias } (multicategoría).
 *   3. Nuevo nodo Code "Parsear Respuesta Estructurada" (mantiene la forma `candidates` para el resto del flujo).
 *   4. Rama de persistencia (después de responder al cliente):
 *        Normalizar Registro PC07 -> Clasificar Categorías -> Guardar Interacción Chatbot (RPC Supabase)
 *   5. Nuevo webhook "pc07-registrar-chat" (usado por el backend cuando responde por la vía directa a Gemini):
 *        Webhook - Registrar Chat -> Normalizar Registro Chat -> ¿Registro Válido? -> Clasificar Categorías
 *
 * Uso:  node n8n/patch_chatbot_historial.js
 * Es idempotente (si ya fue aplicado no vuelve a modificar el archivo) y NO sube nada a n8n:
 * luego se debe importar/actualizar el workflow manualmente en n8n.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKFLOW_FILES = [
  path.join(__dirname, 'workflows', 'peluqueria_carolina_cloud.json'),
  path.join(__dirname, 'workflows', 'claude_patched.json'),
];
const ENV_PATH = path.join(__dirname, '..', 'backend', '.env');
const DEFAULT_SUPABASE_CRED = { id: 'fe7my6tI8Cbsg2x2', name: 'Supabase account' };

const CATEGORIAS = [
  'servicios', 'precios', 'horarios', 'estilistas', 'reservar_hora',
  'cancelar_reprogramar', 'ubicacion_contacto', 'faqs', 'otros',
];

// URL del proyecto Supabase (no es un secreto) tomada de backend/.env
const envText = fs.readFileSync(ENV_PATH, 'utf8');
const m = envText.match(/^SUPABASE_URL\s*=\s*(\S+)/m);
if (!m) throw new Error('SUPABASE_URL no encontrada en backend/.env');
const SUPABASE_URL = m[1].replace(/\/+$/, '');

function patchWorkflowFile(WF_PATH) {
  if (!fs.existsSync(WF_PATH)) return;
  const raw = fs.readFileSync(WF_PATH, 'utf8');
  const wf = JSON.parse(raw);

  if (wf.nodes.some((n) => n.name === 'Clasificar Categorías')) {
    console.log(`[${path.basename(WF_PATH)}] Ya tiene el historial de chatbot aplicado. Sin cambios.`);
    return;
  }

  const SUPABASE_CRED =
    wf.nodes.find((n) => n.credentials && n.credentials.supabaseApi)?.credentials?.supabaseApi ||
    DEFAULT_SUPABASE_CRED;

  const byName = (name) => {
    const node = wf.nodes.find((n) => n.name === name);
    if (!node) throw new Error(`Nodo no encontrado en ${path.basename(WF_PATH)}: ${name}`);
    return node;
  };

  const uuid = () => crypto.randomUUID();

  const setField = (name, value, type = 'string') => ({ id: uuid(), name, value, type });

  const setNode = (name, position, assignments) => ({
    parameters: { assignments: { assignments }, options: {} },
    id: uuid(),
    name,
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    position,
  });

  const codeNode = (name, position, jsCode) => ({
    parameters: { mode: 'runOnceForEachItem', jsCode },
    id: uuid(),
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
  });

  const connect = (from, to, outputIndex = 0) => {
    wf.connections[from] = wf.connections[from] || { main: [] };
    const main = wf.connections[from].main;
    while (main.length <= outputIndex) main.push([]);
    if (!main[outputIndex].some((c) => c.node === to)) {
      main[outputIndex].push({ node: to, type: 'main', index: 0 });
    }
  };

  const replaceOnce = (str, from, to, label) => {
    const count = str.split(from).length - 1;
    if (count !== 1) throw new Error(`[${label}] el fragmento esperado aparece ${count} veces`);
    return str.replace(from, () => to);
  };

// ─────────────── 1. Validar Payload5: session_id, canal, timestamp ───────────────
const validar = byName('Validar Payload5');
validar.parameters.assignments.assignments.push(
  setField(
    'session_id',
    "={{ String(($json.body ?? $json).session_id ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100) || ('anon-' + $execution.id) }}"
  ),
  setField(
    'canal',
    "={{ ['web', 'whatsapp'].includes(String(($json.body ?? $json).canal ?? '')) ? String(($json.body ?? $json).canal) : 'web' }}"
  ),
  setField('timestamp_iso', '={{ $now.toISO() }}')
);

// ─────────────── 2. Consultar Gemini: salida estructurada con categorías ───────────────
const gemini = byName('Consultar Gemini');
let body = gemini.parameters.jsonBody;
body = replaceOnce(
  body,
  "'7. No entregues consejos médicos ni diagnósticos.']",
  "'7. No entregues consejos médicos ni diagnósticos.', '8. Debes responder SIEMPRE con un objeto JSON con los campos \"respuesta\" (texto para el cliente) y \"categorias\" (arreglo con una o más categorías de esta lista cerrada: " +
    CATEGORIAS.join(', ') +
    ").', '9. Clasifica la consulta por TODOS los temas que menciona el cliente; si consulta varios temas incluye varias categorías (ej.: precio del balayage y horario de atención = servicios, precios, horarios). Usa otros solo si no corresponde a ninguna categoría.']",
  'Gemini systemInstruction'
);
const schema =
  "responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { respuesta: { type: 'STRING' }, categorias: { type: 'ARRAY', minItems: 1, items: { type: 'STRING', enum: " +
  JSON.stringify(CATEGORIAS).replace(/"/g, "'") +
  " } } }, required: ['respuesta', 'categorias'] }";
body = replaceOnce(
  body,
  "thinkingConfig: { thinkingLevel: 'low' } }",
  "thinkingConfig: { thinkingLevel: 'low' }, " + schema + ' }',
  'Gemini generationConfig'
);
gemini.parameters.jsonBody = body;

// ─────────────── 3. Parsear Respuesta Estructurada (entre Gemini y Validar Respuesta) ───────────────
const parsearCode = String.raw`// Convierte la salida JSON estructurada de Gemini en la forma "candidates" que espera el resto del flujo
// y expone las categorías detectadas. Tolera JSON truncado sin exponerlo al cliente.
const item = $json;
const parts = ((item.candidates ?? [])[0]?.content?.parts ?? []).filter((p) => !p.thought);
const raw = parts.map((p) => p.text ?? '').join('').trim();
let respuesta = raw;
let categorias = [];

if (raw) {
  let obj = null;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    const mResp = raw.match(/"respuesta"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (mResp) {
      try { obj = { respuesta: JSON.parse('"' + mResp[1] + '"') }; } catch (e2) { obj = null; }
    }
    const mCats = raw.match(/"categorias"\s*:\s*\[([^\]]*)\]/);
    if (mCats) categorias = (mCats[1].match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ''));
  }
  if (obj && typeof obj.respuesta === 'string') {
    respuesta = obj.respuesta.trim();
    if (Array.isArray(obj.categorias)) categorias = obj.categorias.map(String);
  } else if (raw.startsWith('{')) {
    respuesta = '';
  }
}

return {
  json: {
    candidates: [{ content: { parts: [{ text: respuesta }] } }],
    error: item.error,
    categorias_gemini: categorias,
  },
};`;

const parsear = codeNode('Parsear Respuesta Estructurada', [8150, 4800], parsearCode);
wf.nodes.push(parsear);
wf.connections['Consultar Gemini'] = { main: [[{ node: parsear.name, type: 'main', index: 0 }]] };
wf.connections[parsear.name] = { main: [[{ node: 'Validar Respuesta Gemini', type: 'main', index: 0 }]] };

// ─────────────── 4. Rama de persistencia del flujo PC07 ───────────────
const normalizarPc07 = setNode('Normalizar Registro PC07', [9152, 5150], [
  setField('session_id', "={{ $('Validar Payload5').first().json.session_id }}"),
  setField('mensaje', "={{ $('Validar Payload5').first().json.mensaje }}"),
  setField('respuesta', '={{ $json.respuesta }}'),
  setField(
    'categorias_gemini',
    "={{ (() => { try { return $('Parsear Respuesta Estructurada').first().json.categorias_gemini ?? []; } catch (e) { return []; } })() }}",
    'array'
  ),
  setField('canal', "={{ $('Validar Payload5').first().json.canal }}"),
  setField('origen', 'n8n'),
  setField('timestamp_iso', "={{ $('Validar Payload5').first().json.timestamp_iso }}"),
]);

const clasificarCode = String.raw`// Clasifica la interacción en 1..N categorías de un catálogo cerrado.
// Prioriza las categorías devueltas por Gemini; si no hay ninguna válida usa palabras clave como respaldo.
const VALIDAS = ${JSON.stringify(CATEGORIAS)};
const REGLAS = [
  ['precios', /(precio|valor(es)?\b|cuesta|cuanto sale|cuanto vale|tarifa|costo|cobran|\$)/],
  ['horarios', /(horario|abierto|abren|abre\b|cierran|cierra\b|atienden|atiende|a que hora|hasta que hora|domingo|sabado|feriado)/],
  ['reservar_hora', /(reservar|agendar|nueva cita|sacar (una )?(hora|cita)|quiero (una )?(hora|cita)|hora para|disponibilidad|turno|pedir hora|tomar hora)/],
  ['cancelar_reprogramar', /(cancelar|anular|reprogramar|cambiar (mi )?(hora|cita)|mover (mi )?(hora|cita))/],
  ['estilistas', /(estilista|peluquer[oa]|barbero|profesional|quien (realiza|hace|atiende)|carolina|matias|camila|gonzalo|valentina|equipo)/],
  ['servicios', /(servicio|corte|balayage|coloracion|tinte|alisado|botox|manicur|barba|peinado|tratamiento|k18|olaplex|fade|masaje|brushing|lavado|cuanto (demora|dura|tarda))/],
  ['ubicacion_contacto', /(direccion|ubicacion|donde (esta|queda)|como llegar|telefono|whatsapp|contacto|instagram|correo|san fernando|mapa)/],
  ['faqs', /(medios? de pago|pagar|pago\b|tarjeta|cuotas|efectivo|transferencia|preparar|prepararme|politica|recargo|anticipacion)/],
];
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const j = $json;
let cats = (Array.isArray(j.categorias_gemini) ? j.categorias_gemini : [])
  .map((c) => norm(c).trim())
  .filter((c) => VALIDAS.includes(c));

if (cats.length === 0) {
  const txt = norm(j.mensaje);
  cats = REGLAS.filter(([, re]) => re.test(txt)).map(([c]) => c);
}
cats = [...new Set(cats)].sort();
if (cats.length > 1) cats = cats.filter((c) => c !== 'otros');
if (cats.length === 0) cats = ['otros'];

return {
  json: {
    session_id: j.session_id,
    mensaje: j.mensaje,
    respuesta: j.respuesta,
    categorias: cats,
    canal: j.canal,
    origen: j.origen,
    timestamp_iso: j.timestamp_iso,
  },
};`;
const clasificar = codeNode('Clasificar Categorías', [9400, 5150], clasificarCode);

const guardar = {
  parameters: {
    method: 'POST',
    url: `${SUPABASE_URL}/rest/v1/rpc/registrar_interaccion_chatbot`,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'supabaseApi',
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody:
      '={{ JSON.stringify({ p_session_id: $json.session_id, p_mensaje_usuario: $json.mensaje, p_respuesta_bot: $json.respuesta, p_categorias: $json.categorias, p_canal: $json.canal, p_origen: $json.origen, p_timestamp: $json.timestamp_iso }) }}',
    options: { timeout: 15000 },
  },
  id: uuid(),
  name: 'Guardar Interacción Chatbot',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [9648, 5150],
  credentials: { supabaseApi: SUPABASE_CRED },
  onError: 'continueRegularOutput',
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 1000,
  notes:
    'Persiste la interacción vía RPC atómica registrar_interaccion_chatbot (migración 008). Un fallo aquí NO afecta la respuesta al cliente.',
};

wf.nodes.push(normalizarPc07, clasificar, guardar);

// La respuesta al cliente va PRIMERO; el registro se ejecuta después (no demora el chat)
for (const origen of ['Resultado - Respuesta Generada', 'Resultado - Sin Información']) {
  const conn = wf.connections[origen];
  if (!conn || !conn.main[0].some((c) => c.node === 'Responder Webhook5')) {
    throw new Error(`Conexión inesperada en ${origen}`);
  }
  connect(origen, normalizarPc07.name);
}
connect(normalizarPc07.name, clasificar.name);
connect(clasificar.name, guardar.name);

// ─────────────── 5. Webhook de registro (vía directa del backend) ───────────────
const webhook = {
  parameters: { httpMethod: 'POST', path: 'pc07-registrar-chat', responseMode: 'onReceived', options: {} },
  id: uuid(),
  name: 'Webhook - Registrar Chat',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: [7520, 5500],
  webhookId: uuid(),
  notes:
    'El backend (respuesta directa de Gemini) envía aquí cada interacción para clasificarla y guardarla en Supabase. Responde 200 de inmediato.',
};

const B = '($json.body ?? $json)';
const normalizarRegistro = setNode('Normalizar Registro Chat', [7776, 5500], [
  setField('session_id', `={{ String(${B}.session_id ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100) }}`),
  setField('mensaje', `={{ String(${B}.mensaje ?? '').trim().slice(0, 2000) }}`),
  setField('respuesta', `={{ String(${B}.respuesta ?? '').trim().slice(0, 4000) }}`),
  setField(
    'categorias_gemini',
    `={{ Array.isArray(${B}.categorias) ? ${B}.categorias.map(String) : [] }}`,
    'array'
  ),
  setField(
    'canal',
    `={{ ['web', 'whatsapp'].includes(String(${B}.canal ?? '')) ? String(${B}.canal) : 'web' }}`
  ),
  setField(
    'origen',
    `={{ ['n8n', 'gemini_direct'].includes(String(${B}.origen ?? '')) ? String(${B}.origen) : 'gemini_direct' }}`
  ),
  setField(
    'timestamp_iso',
    `={{ (() => { const t = new Date(String(${B}.timestamp ?? '')); return isNaN(t.getTime()) ? $now.toISO() : t.toISOString(); })() }}`
  ),
  setField(
    'payload_valido',
    `={{ String(${B}.evento ?? '') === 'registrar_interaccion_chat' && /^[A-Za-z0-9_-]{8,100}$/.test(String(${B}.session_id ?? '').trim()) && String(${B}.mensaje ?? '').trim().length > 0 && String(${B}.respuesta ?? '').trim().length > 0 }}`,
    'boolean'
  ),
]);

const registroValido = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [
        {
          id: uuid(),
          leftValue: '={{ $json.payload_valido }}',
          rightValue: '',
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        },
      ],
      combinator: 'and',
    },
    looseTypeValidation: true,
    options: {},
  },
  id: uuid(),
  name: '¿Registro Válido?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [8032, 5500],
};

wf.nodes.push(webhook, normalizarRegistro, registroValido);
connect(webhook.name, normalizarRegistro.name);
connect(normalizarRegistro.name, registroValido.name);
connect(registroValido.name, clasificar.name, 0);

// ─────────────── Validaciones de integridad y escritura ───────────────
const names = wf.nodes.map((n) => n.name);
if (new Set(names).size !== names.length) throw new Error('Nombres de nodo duplicados');
const ids = wf.nodes.map((n) => n.id);
if (new Set(ids).size !== ids.length) throw new Error('IDs de nodo duplicados');
for (const [from, conn] of Object.entries(wf.connections)) {
  if (!names.includes(from)) throw new Error(`Conexión desde nodo inexistente: ${from}`);
  for (const outs of conn.main || []) {
    for (const c of outs || []) {
      if (!names.includes(c.node)) throw new Error(`Conexión hacia nodo inexistente: ${c.node}`);
    }
  }
}

  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  let out = JSON.stringify(wf, null, 2);
  if (eol === '\r\n') out = out.replace(/\n/g, '\r\n');
  fs.writeFileSync(WF_PATH, out + (raw.endsWith('\n') ? eol : ''));
  console.log(`[${path.basename(WF_PATH)}] Actualizado (${wf.nodes.length} nodos, cred Supabase=${SUPABASE_CRED.id}).`);
}

for (const wfPath of WORKFLOW_FILES) {
  patchWorkflowFile(wfPath);
}

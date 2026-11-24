/**
 * Prueba offline del pipeline de historial del chatbot (Fase 3), sin red ni Supabase:
 *   1. chatbot.service (catálogo, clasificador heurístico, session_id, URL de registro)
 *   2. asistente.controller (vía directa a Gemini -> respuesta inmediata + despacho asíncrono a n8n)
 *   3. Workflow n8n (nodos nuevos: expresiones y código compilan y producen el payload esperado)
 *
 * Uso: node test_chatbot_historial.js
 */
process.env.GEMINI_API_KEY = 'test-key';
process.env.N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/pc06-webhook-router';
process.env.INTERNAL_API_KEY = 'internal-test-key';
delete process.env.N8N_ASISTENTE_URL;
delete process.env.N8N_REGISTRO_CHAT_URL;

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const svc = require('./src/services/chatbot.service');
const { consultarAsistente } = require('./src/controllers/asistente.controller');

let pasados = 0;
const ok = (nombre) => {
  pasados += 1;
  console.log(`  ✔ ${nombre}`);
};

// ───────────────────────── 1. Servicio ─────────────────────────
console.log('1) chatbot.service');
assert.deepStrictEqual(
  svc.normalizarCategorias(['Precios', 'servicios', 'servicios', 'inventada']),
  ['precios', 'servicios']
);
ok('filtra al catálogo, deduplica y ordena');

assert.deepStrictEqual(svc.normalizarCategorias(['otros', 'precios']), ['precios']);
assert.deepStrictEqual(svc.normalizarCategorias([]), ['otros']);
ok("descarta 'otros' si hay otras categorías y garantiza al menos 'otros'");

assert.deepStrictEqual(
  svc.normalizarCategorias([], '¿Cuánto cuesta el balayage y atienden los sábados?'),
  ['horarios', 'precios', 'servicios']
);
ok('respaldo heurístico multicategoría (servicios + precios + horarios)');

assert.deepStrictEqual(svc.normalizarCategorias([], 'Quiero cancelar mi cita'), ['cancelar_reprogramar']);
assert.deepStrictEqual(svc.normalizarCategorias([], 'Quiero agendar una hora'), ['reservar_hora']);
assert.deepStrictEqual(svc.normalizarCategorias([], 'hola'), ['otros']);
ok('sin falsos positivos entre cancelar/reservar y saludo = otros');

assert.strictEqual(svc.resolverSessionId('web-1234-abcd'), 'web-1234-abcd');
assert.ok(svc.resolverSessionId('x').startsWith('anon-'));
assert.ok(svc.resolverSessionId(undefined).startsWith('anon-'));
ok('session_id válido se conserva; inválido/ausente genera anon-<uuid>');

assert.strictEqual(svc.resolverUrlRegistroChat(), 'http://localhost:5678/webhook/pc07-registrar-chat');
ok('URL de registro derivada de N8N_WEBHOOK_URL');

// ───────────────────────── 2. Controlador ─────────────────────────
const makeRes = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

const respGemini = (text, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  text: async () => '',
});

const llamadas = [];
const instalarFetch = (geminiHandler) => {
  llamadas.length = 0;
  global.fetch = async (url, opts) => {
    llamadas.push({ url: String(url), opts });
    if (String(url).includes('generativelanguage.googleapis.com')) return geminiHandler(JSON.parse(opts.body));
    return { ok: true, status: 200, text: async () => '', json: async () => ({}) };
  };
};
const esperar = (ms = 25) => new Promise((r) => setTimeout(r, ms));
const registros = () => llamadas.filter((c) => c.url.includes('pc07-registrar-chat'));

(async () => {
  console.log('2) asistente.controller (vía directa)');

  // 2a. Salida estructurada válida con múltiples categorías
  instalarFetch((body) => {
    assert.strictEqual(body.generationConfig.responseMimeType, 'application/json');
    assert.deepStrictEqual(
      body.generationConfig.responseSchema.properties.categorias.items.enum,
      svc.CATEGORIAS_CHATBOT
    );
    assert.ok(body.systemInstruction.parts[0].text.includes('"categorias"'));
    return respGemini(JSON.stringify({ respuesta: 'El balayage cuesta $85.000.', categorias: ['precios', 'servicios'] }));
  });
  let res = makeRes();
  await consultarAsistente(
    { body: { mensaje: '¿Cuánto cuesta el balayage?', session_id: 'web-abcdef-123456' } },
    res,
    (e) => { throw e; }
  );
  await esperar();
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.respuesta, 'El balayage cuesta $85.000.');
  assert.strictEqual(res.body.data.session_id, 'web-abcdef-123456');
  assert.strictEqual(registros().length, 1);
  const payload = JSON.parse(registros()[0].opts.body);
  assert.strictEqual(payload.evento, 'registrar_interaccion_chat');
  assert.strictEqual(payload.session_id, 'web-abcdef-123456');
  assert.strictEqual(payload.origen, 'gemini_direct');
  assert.deepStrictEqual(payload.categorias, ['precios', 'servicios']);
  assert.ok(!isNaN(new Date(payload.timestamp).getTime()));
  assert.strictEqual(registros()[0].opts.headers['x-api-key'], 'internal-test-key');
  ok('responde con el texto limpio y despacha el registro (categorías multi-tema + timestamp)');

  // 2b. JSON truncado por maxOutputTokens: no se filtra JSON crudo al cliente
  instalarFetch(() => respGemini('{"respuesta": "Hola, te cuento que el corte vale $24.990", "categorias": ["precios"'));
  res = makeRes();
  await consultarAsistente({ body: { mensaje: 'precio corte mujer' } }, res, (e) => { throw e; });
  await esperar();
  assert.strictEqual(res.body.data.respuesta, 'Hola, te cuento que el corte vale $24.990');
  assert.ok(res.body.data.session_id.startsWith('anon-'));
  assert.ok(!res.body.data.respuesta.includes('{'));
  ok('JSON truncado se recupera sin exponer llaves/JSON al cliente; sin session_id => anon-*');

  // 2c. Gemini rechaza el modo JSON (400): reintento en texto plano + clasificación heurística
  let intentos = 0;
  instalarFetch((body) => {
    intentos += 1;
    if (body.generationConfig.responseSchema) return respGemini('', 400);
    return respGemini('Atendemos de lunes a sábado desde las 09:00 hrs.');
  });
  res = makeRes();
  await consultarAsistente(
    { body: { mensaje: '¿A qué hora abren los sábados?', session_id: 'web-retry-0001' } },
    res,
    (e) => { throw e; }
  );
  await esperar();
  assert.strictEqual(intentos, 2);
  assert.strictEqual(res.body.data.respuesta, 'Atendemos de lunes a sábado desde las 09:00 hrs.');
  assert.deepStrictEqual(JSON.parse(registros()[0].opts.body).categorias, ['horarios']);
  ok('HTTP 400 en modo JSON => reintento en texto + clasificación por palabras clave');

  // ───────────────────────── 3. Workflow n8n ─────────────────────────
  console.log('3) Workflow n8n (nodos nuevos)');
  const wf = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'n8n', 'workflows', 'peluqueria_carolina_cloud.json'), 'utf8')
  );
  const nodo = (n) => {
    const x = wf.nodes.find((k) => k.name === n);
    assert.ok(x, `falta el nodo ${n}`);
    return x;
  };
  const exprDe = (n, campo) => {
    const a = nodo(n).parameters.assignments.assignments.find((k) => k.name === campo);
    assert.ok(a, `falta ${campo} en ${n}`);
    return a.value;
  };
  const evalExpr = (expr, ctx) => {
    assert.ok(expr.startsWith('={{') && expr.endsWith('}}'));
    const fn = new Function('$json', '$now', '$execution', '$', `return (${expr.slice(3, -2).trim()})`);
    return fn(ctx.json || {}, { toISO: () => '2026-10-05T10:00:00.000-03:00' }, { id: '777' }, ctx.dollar || (() => { throw new Error('no $'); }));
  };
  const runCode = (n, json) => new Function('$json', nodo(n).parameters.jsCode)(json).json;

  // 3a. Gemini: la expresión compila y pide salida estructurada
  const dollar = () => ({ first: () => ({ json: { mensaje: 'hola' } }) });
  const geminiBody = JSON.parse(evalExpr(nodo('Consultar Gemini').parameters.jsonBody, { json: { contexto: 'ctx' }, dollar }));
  assert.strictEqual(geminiBody.generationConfig.responseMimeType, 'application/json');
  assert.ok(geminiBody.systemInstruction.parts[0].text.includes('categorias'));
  assert.deepStrictEqual(geminiBody.generationConfig.responseSchema.properties.categorias.items.enum, svc.CATEGORIAS_CHATBOT);
  ok('Consultar Gemini: jsonBody evalúa y exige JSON {respuesta, categorias}');

  // 3b. Validar Payload5
  const vp = (campo, body) => evalExpr(exprDe('Validar Payload5', campo), { json: { body } });
  assert.strictEqual(vp('session_id', { session_id: 'web-ABC_123-xyz' }), 'web-ABC_123-xyz');
  assert.strictEqual(vp('session_id', {}), 'anon-777');
  assert.strictEqual(vp('canal', { canal: 'otro' }), 'web');
  assert.strictEqual(vp('timestamp_iso', {}), '2026-10-05T10:00:00.000-03:00');
  ok('Validar Payload5: session_id / canal / timestamp_iso');

  // 3c. Parsear Respuesta Estructurada
  const conf = (text, extra = {}) => ({ candidates: [{ content: { parts: [{ text }] } }], ...extra });
  let r = runCode('Parsear Respuesta Estructurada', conf(JSON.stringify({ respuesta: 'Hola', categorias: ['faqs'] })));
  assert.strictEqual(r.candidates[0].content.parts[0].text, 'Hola');
  assert.deepStrictEqual(r.categorias_gemini, ['faqs']);
  r = runCode('Parsear Respuesta Estructurada', conf('{"respuesta": "Texto parcial", "categorias": ["precios"'));
  assert.strictEqual(r.candidates[0].content.parts[0].text, 'Texto parcial');
  r = runCode('Parsear Respuesta Estructurada', conf('{"categorias": ["precios"], "respuesta": "cortado'));
  assert.strictEqual(r.candidates[0].content.parts[0].text, '');
  r = runCode('Parsear Respuesta Estructurada', conf('Texto plano sin JSON'));
  assert.strictEqual(r.candidates[0].content.parts[0].text, 'Texto plano sin JSON');
  ok('Parsear Respuesta Estructurada: JSON válido, truncado recuperable, irrecuperable (vacío) y texto plano');

  // 3d. Normalizar Registro PC07 (con y sin nodo de Gemini ejecutado)
  const store = { 'Validar Payload5': { session_id: 's-1234567', mensaje: 'm', canal: 'web', timestamp_iso: 'T' } };
  const dPc07 = (conGemini) => (name) => ({
    first: () => {
      if (name === 'Parsear Respuesta Estructurada' && !conGemini) throw new Error('nodo no ejecutado');
      return { json: name === 'Parsear Respuesta Estructurada' ? { categorias_gemini: ['precios'] } : store[name] };
    },
  });
  assert.deepStrictEqual(
    evalExpr(exprDe('Normalizar Registro PC07', 'categorias_gemini'), { json: {}, dollar: dPc07(true) }),
    ['precios']
  );
  assert.deepStrictEqual(
    evalExpr(exprDe('Normalizar Registro PC07', 'categorias_gemini'), { json: {}, dollar: dPc07(false) }),
    []
  );
  assert.strictEqual(evalExpr(exprDe('Normalizar Registro PC07', 'session_id'), { json: {}, dollar: dPc07(true) }), 's-1234567');
  ok('Normalizar Registro PC07: toma datos de Validar Payload5 y tolera la ruta "Sin Información"');

  // 3e. Webhook de registro: normalización y validación
  const reg = (campo, body) => evalExpr(exprDe('Normalizar Registro Chat', campo), { json: { body } });
  const bodyOk = {
    evento: 'registrar_interaccion_chat', session_id: 'web-abcdef-123456', mensaje: 'hola',
    respuesta: 'buenas', categorias: ['precios', 'servicios'], canal: 'web', origen: 'gemini_direct',
    timestamp: '2026-10-05T13:00:00.000Z',
  };
  assert.strictEqual(reg('payload_valido', bodyOk), true);
  assert.strictEqual(reg('payload_valido', { ...bodyOk, session_id: 'x' }), false);
  assert.strictEqual(reg('payload_valido', { ...bodyOk, respuesta: '' }), false);
  assert.strictEqual(reg('payload_valido', { ...bodyOk, evento: 'otro' }), false);
  assert.deepStrictEqual(reg('categorias_gemini', bodyOk), ['precios', 'servicios']);
  assert.strictEqual(reg('timestamp_iso', bodyOk), '2026-10-05T13:00:00.000Z');
  assert.strictEqual(reg('timestamp_iso', { ...bodyOk, timestamp: 'basura' }), '2026-10-05T10:00:00.000-03:00');
  assert.strictEqual(reg('origen', { ...bodyOk, origen: 'hack' }), 'gemini_direct');
  ok('Normalizar Registro Chat: valida payload, categorías, timestamp y whitelist de origen');

  // 3f. Clasificar Categorías (n8n)
  let c = runCode('Clasificar Categorías', { session_id: 's', mensaje: '¿Cuánto cuesta el balayage y atienden los sábados?', respuesta: 'r', categorias_gemini: [], canal: 'web', origen: 'n8n', timestamp_iso: 'T' });
  assert.deepStrictEqual(c.categorias, ['horarios', 'precios', 'servicios']);
  c = runCode('Clasificar Categorías', { session_id: 's', mensaje: 'x', respuesta: 'r', categorias_gemini: ['Precios', 'inventada', 'otros'], canal: 'web', origen: 'n8n', timestamp_iso: 'T' });
  assert.deepStrictEqual(c.categorias, ['precios']);
  c = runCode('Clasificar Categorías', { session_id: 's', mensaje: 'hola', respuesta: 'r', categorias_gemini: [], canal: 'web', origen: 'n8n', timestamp_iso: 'T' });
  assert.deepStrictEqual(c.categorias, ['otros']);
  // Paridad con el clasificador del backend
  for (const t of ['quiero cancelar mi cita', 'quiero agendar una hora', 'donde queda el salon', 'aceptan tarjeta y cuotas', 'quien es carolina', 'hola']) {
    const n8n = runCode('Clasificar Categorías', { session_id: 's', mensaje: t, respuesta: 'r', categorias_gemini: [], canal: 'web', origen: 'n8n', timestamp_iso: 'T' }).categorias;
    assert.deepStrictEqual(n8n, svc.normalizarCategorias([], t), `paridad n8n/backend: "${t}"`);
  }
  ok('Clasificar Categorías: prioriza Gemini, respaldo heurístico y paridad exacta con el backend');

  // 3g. Guardar Interacción Chatbot: payload de la RPC
  const g = nodo('Guardar Interacción Chatbot');
  assert.ok(g.parameters.url.endsWith('/rest/v1/rpc/registrar_interaccion_chatbot'));
  assert.strictEqual(g.parameters.nodeCredentialType, 'supabaseApi');
  const rpcBody = JSON.parse(evalExpr(g.parameters.jsonBody, { json: { session_id: 'web-abcdef-123456', mensaje: 'm', respuesta: 'r', categorias: ['precios'], canal: 'web', origen: 'n8n', timestamp_iso: '2026-10-05T10:00:00-03:00' } }));
  assert.deepStrictEqual(Object.keys(rpcBody).sort(), ['p_canal', 'p_categorias', 'p_mensaje_usuario', 'p_origen', 'p_respuesta_bot', 'p_session_id', 'p_timestamp']);
  ok('Guardar Interacción Chatbot: payload coincide con la firma de la RPC');

  // 3h. Cableado del grafo
  const salidas = (n, i = 0) => (wf.connections[n]?.main?.[i] || []).map((x) => x.node);
  assert.deepStrictEqual(salidas('Consultar Gemini'), ['Parsear Respuesta Estructurada']);
  assert.deepStrictEqual(salidas('Parsear Respuesta Estructurada'), ['Validar Respuesta Gemini']);
  assert.deepStrictEqual(salidas('Resultado - Respuesta Generada'), ['Responder Webhook5', 'Normalizar Registro PC07']);
  assert.deepStrictEqual(salidas('Resultado - Sin Información'), ['Responder Webhook5', 'Normalizar Registro PC07']);
  assert.deepStrictEqual(salidas('Normalizar Registro PC07'), ['Clasificar Categorías']);
  assert.deepStrictEqual(salidas('Clasificar Categorías'), ['Guardar Interacción Chatbot']);
  assert.deepStrictEqual(salidas('Webhook - Registrar Chat'), ['Normalizar Registro Chat']);
  assert.deepStrictEqual(salidas('¿Registro Válido?', 0), ['Clasificar Categorías']);
  assert.strictEqual(nodo('Webhook - Registrar Chat').parameters.path, 'pc07-registrar-chat');
  assert.strictEqual(nodo('Webhook - Registrar Chat').parameters.responseMode, 'onReceived');
  ok('Cableado: respuesta al cliente primero, persistencia después; webhook pc07-registrar-chat');

  console.log(`\n✅ ${pasados} verificaciones OK`);
})().catch((err) => {
  console.error('\n❌ Falló la verificación:', err);
  process.exit(1);
});

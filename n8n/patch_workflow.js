const fs = require('fs');

const wfs = JSON.parse(fs.readFileSync('./n8n/workflows/exported_workflows.json', 'utf8'));
const claude = wfs.find((w) => w.name === 'workflows claude');

console.log('Total nodes en claude inicial:', claude.nodes.length);

// 1. Corregir check constraints de Supabase (tildes / mayúsculas):
let replacements = 0;
function deepFix(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      if (obj[key] === 'confirmación') {
        obj[key] = 'confirmacion';
        replacements++;
      } else if (obj[key] === 'cancelación') {
        obj[key] = 'cancelacion';
        replacements++;
      } else if (obj[key] === 'reprogramación') {
        obj[key] = 'reprogramacion';
        replacements++;
      } else if (obj[key] === 'WhatsApp') {
        obj[key] = 'whatsapp';
        replacements++;
      }
    } else if (typeof obj[key] === 'object') {
      deepFix(obj[key]);
    }
  }
}
deepFix(claude.nodes);
console.log(`Reemplazos de constraint (tildes / mayúsculas): ${replacements}`);

// 2. Asegurar idioma es_CL en todos los nodos Preparar Mensaje (0 a 4)
const prepNodes = ['Preparar Mensaje', 'Preparar Mensaje1', 'Preparar Mensaje2', 'Preparar Mensaje3', 'Preparar Mensaje4'];
prepNodes.forEach((name) => {
  const node = claude.nodes.find((n) => n.name === name);
  if (node && node.parameters && node.parameters.assignments) {
    const assignments = node.parameters.assignments.assignments;
    let waLang = assignments.find((a) => a.name === 'whatsapp_idioma');
    if (!waLang) {
      assignments.push({
        id: 'wa-lang-' + Date.now() + Math.random(),
        name: 'whatsapp_idioma',
        value: 'es_CL',
        type: 'string',
      });
    } else {
      waLang.value = 'es_CL';
    }
  }
});

// Helper de expresión JS para calcular el Código de Reserva (PC-<ID>-<HASH4>) y enlaces de 2 botones en n8n
const CODE_GEN_FN = `
  const calcCodigo = (r) => {
    if (r && r.codigo_reserva) return String(r.codigo_reserva).toUpperCase();
    const idStr = String(r?.id ?? '').trim();
    const dt = r?.fecha_hora_inicio ? new Date(r.fecha_hora_inicio) : null;
    const epochMin = dt && !isNaN(dt.getTime()) ? Math.floor(dt.getTime() / 60000) : 0;
    const seed = idStr + ':' + epochMin;
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const suffix = (h >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
    const idClean = /^\\d+$/.test(idStr) ? idStr : idStr.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    return 'PC-' + idClean + '-' + suffix;
  };
  const buildManageUrl = (cod, accion, tok) => {
    const authParam = tok ? ('&token=' + encodeURIComponent(tok)) : '';
    return 'http://localhost:3000/?reserva=' + encodeURIComponent(cod) + authParam + '&accion=' + encodeURIComponent(accion) + '#reservar';
  };
`;

function upsertAssignment(assignments, name, value, type = 'string') {
  let item = assignments.find((a) => a.name === name);
  if (!item) {
    assignments.push({
      id: `assign-${name}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      value,
      type,
    });
  } else {
    item.value = value;
    item.type = type;
  }
}

// 3. Configurar Preparar Mensaje (PC01 - Confirmación con Código de Reserva + 2 Botones)
const prep0 = claude.nodes.find((n) => n.name === 'Preparar Mensaje');
if (prep0 && prep0.parameters && prep0.parameters.assignments) {
  const assignments = prep0.parameters.assignments.assignments;

  upsertAssignment(
    assignments,
    'codigo_reserva',
    `={{ (() => { ${CODE_GEN_FN} return calcCodigo($('Consultar Reserva').item.json); })() }}`
  );

  upsertAssignment(
    assignments,
    'whatsapp_parametros',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva').item.json; const COD = calcCodigo(R); const C = $('Consultar Cliente').item.json; const S = $('Consultar Servicio').item.json; const E = $('Consultar Estilista').item.json; const F = $('Calcular Fecha y Hora').item.json; return [ C.nombre_completo, S.nombre, F.fecha_texto, F.hora_texto, E.nombre + ' | 🔖 Código de Reserva: ' + COD ]; })() }}`,
    'array'
  );

  upsertAssignment(
    assignments,
    'whatsapp_texto',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva').item.json; const COD = calcCodigo(R); const TOK = $('Validar Payload').item.json.gestion_token || ''; const C = $('Consultar Cliente').item.json; const S = $('Consultar Servicio').item.json; const E = $('Consultar Estilista').item.json; const F = $('Calcular Fecha y Hora').item.json; const urlReprog = buildManageUrl(COD, 'reprogramar', TOK); const urlCancel = buildManageUrl(COD, 'cancelar', TOK); return '¡Hola ' + C.nombre_completo + '! ✨ Tu cita en Peluquería Carolina está confirmada.\\n\\n💇 Servicio: ' + S.nombre + '\\n👤 Profesional: ' + E.nombre + '\\n🔖 Código de Reserva: *' + COD + '*\\n📅 Fecha: ' + F.fecha_texto + '\\n⏰ Hora: ' + F.hora_texto + '\\n\\nSi necesitas cancelar o reprogramar, puedes gestionarlo desde nuestra web:\\n🔄 Reprogramar: ' + urlReprog + '\\n❌ Cancelar: ' + urlCancel + '\\n\\n¡Te esperamos!'; })() }}`
  );

  upsertAssignment(
    assignments,
    'email_asunto',
    `={{ (() => { ${CODE_GEN_FN} const COD = calcCodigo($('Consultar Reserva').item.json); return 'Confirmación de tu reserva (' + COD + ') - Peluquería Carolina'; })() }}`
  );

  upsertAssignment(
    assignments,
    'email_html',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva').item.json; const COD = calcCodigo(R); const TOK = $('Validar Payload').item.json.gestion_token || ''; const C = $('Consultar Cliente').item.json; const S = $('Consultar Servicio').item.json; const E = $('Consultar Estilista').item.json; const F = $('Calcular Fecha y Hora').item.json; const e = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); const urlReprog = buildManageUrl(COD, 'reprogramar', TOK); const urlCancel = buildManageUrl(COD, 'cancelar', TOK); return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222222;max-width:560px"><p>Hola <strong>' + e(C.nombre_completo) + '</strong>,</p><p>Tu reserva en <strong>Peluquería Carolina</strong> fue registrada correctamente.</p><div style="background:#f8f5f0;border-left:4px solid #8a5a44;padding:12px 16px;margin:16px 0;border-radius:6px"><strong>Código de Reserva:</strong> <span style="font-family:monospace;font-size:17px;color:#8a5a44;font-weight:bold">' + e(COD) + '</span></div><ul><li><strong>Servicio:</strong> ' + e(S.nombre) + '</li><li><strong>Profesional:</strong> ' + e(E.nombre) + '</li><li><strong>Código de Reserva:</strong> ' + e(COD) + '</li><li><strong>Fecha:</strong> ' + e(F.fecha_texto) + '</li><li><strong>Hora:</strong> ' + e(F.hora_texto) + '</li></ul><p style="margin-top:20px"><strong>¿Necesitas gestionar tu cita?</strong> Usa una de las 2 opciones:</p><div style="margin:18px 0"><a href="' + e(urlReprog) + '" style="display:inline-block;background:#8a5a44;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;margin-right:10px">📅 Reprogramar Cita</a><a href="' + e(urlCancel) + '" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">❌ Cancelar Cita</a></div><p>¡Te esperamos!<br>Peluquería Carolina</p></div>'; })() }}`
  );
}

// 4. Configurar Preparar Mensaje1 (PC02 - Recordatorio 24H con Código de Reserva + 2 Botones)
const prep1 = claude.nodes.find((n) => n.name === 'Preparar Mensaje1');
if (prep1 && prep1.parameters && prep1.parameters.assignments) {
  const assignments = prep1.parameters.assignments.assignments;

  upsertAssignment(
    assignments,
    'codigo_reserva',
    `={{ (() => { ${CODE_GEN_FN} return calcCodigo($('Procesar Reservas').item.json); })() }}`
  );

  upsertAssignment(
    assignments,
    'whatsapp_parametros',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Procesar Reservas').item.json; const COD = calcCodigo(R); const C = $('Consultar Cliente1').item.json; const S = $('Consultar Servicio1').item.json; const E = $('Consultar Estilista1').item.json; const F = $('Calcular Fecha y Hora1').item.json; return [ C.nombre_completo, S.nombre, F.fecha_texto, F.hora_texto, E.nombre + ' | 🔖 Código de Reserva: ' + COD ]; })() }}`,
    'array'
  );

  upsertAssignment(
    assignments,
    'whatsapp_texto',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Procesar Reservas').item.json; const COD = calcCodigo(R); const C = $('Consultar Cliente1').item.json; const S = $('Consultar Servicio1').item.json; const E = $('Consultar Estilista1').item.json; const F = $('Calcular Fecha y Hora1').item.json; const urlReprog = buildManageUrl(COD, 'reprogramar', ''); const urlCancel = buildManageUrl(COD, 'cancelar', ''); return '¡Hola ' + C.nombre_completo + '! ✨ Te recordamos tu cita en Peluquería Carolina en las próximas 24 horas:\\n\\n💇 Servicio: ' + S.nombre + '\\n👤 Profesional: ' + E.nombre + '\\n🔖 Código de Reserva: *' + COD + '*\\n📅 Fecha: ' + F.fecha_texto + '\\n⏰ Hora: ' + F.hora_texto + '\\n\\n🔄 Reprogramar: ' + urlReprog + '\\n❌ Cancelar: ' + urlCancel; })() }}`
  );

  upsertAssignment(
    assignments,
    'email_asunto',
    `={{ (() => { ${CODE_GEN_FN} const COD = calcCodigo($('Procesar Reservas').item.json); return 'Recordatorio de tu cita (' + COD + ') - Peluquería Carolina'; })() }}`
  );

  upsertAssignment(
    assignments,
    'email_html',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Procesar Reservas').item.json; const COD = calcCodigo(R); const C = $('Consultar Cliente1').item.json; const S = $('Consultar Servicio1').item.json; const E = $('Consultar Estilista1').item.json; const F = $('Calcular Fecha y Hora1').item.json; const e = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); const urlReprog = buildManageUrl(COD, 'reprogramar', ''); const urlCancel = buildManageUrl(COD, 'cancelar', ''); return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222222;max-width:560px"><p>Hola <strong>' + e(C.nombre_completo) + '</strong>,</p><p>Te recordamos que tienes una cita programada en <strong>Peluquería Carolina</strong> en las próximas 24 horas:</p><div style="background:#f8f5f0;border-left:4px solid #8a5a44;padding:12px 16px;margin:16px 0;border-radius:6px"><strong>Código de Reserva:</strong> <span style="font-family:monospace;font-size:17px;color:#8a5a44;font-weight:bold">' + e(COD) + '</span></div><ul><li><strong>Servicio:</strong> ' + e(S.nombre) + '</li><li><strong>Profesional:</strong> ' + e(E.nombre) + '</li><li><strong>Fecha:</strong> ' + e(F.fecha_texto) + '</li><li><strong>Hora:</strong> ' + e(F.hora_texto) + '</li></ul><div style="margin:18px 0"><a href="' + e(urlReprog) + '" style="display:inline-block;background:#8a5a44;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;margin-right:10px">📅 Reprogramar Cita</a><a href="' + e(urlCancel) + '" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">❌ Cancelar Cita</a></div><p>¡Te esperamos!<br>Peluquería Carolina</p></div>'; })() }}`
  );

  let waPl = assignments.find((a) => a.name === 'whatsapp_plantilla');
  if (waPl) waPl.value = 'recordatorio_reserva';

  let waLang = assignments.find((a) => a.name === 'whatsapp_idioma');
  if (waLang) waLang.value = 'es_CL';
}

// 5. Credenciales Meta WhatsApp Cloud API (cifradas en n8n mediante setup_whatsapp_credential.js)
const WHATSAPP_PHONE_NUMBER_ID = '1327472783790822';
const WA_CREDENTIALS = {
  httpHeaderAuth: {
    id: 'whatsapp0token0001',
    name: 'WhatsApp Cloud API Token',
  },
};

// 6. Configurar TODOS los 5 nodos Enviar WhatsApp para usar PLANTILLA OFICIAL con idioma es_CL
const waNodes = claude.nodes.filter((n) =>
  ['Enviar WhatsApp', 'Enviar WhatsApp1', 'Enviar WhatsApp2', 'Enviar WhatsApp3', 'Enviar WhatsApp4'].includes(n.name)
);

console.log('Configurando nodos Enviar WhatsApp con credencial cifrada en n8n:', waNodes.map((n) => n.name));

waNodes.forEach((node) => {
  node.type = 'n8n-nodes-base.httpRequest';
  node.typeVersion = 4.2;
  node.onError = 'continueRegularOutput';
  node.credentials = WA_CREDENTIALS;
  node.parameters = {
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: $json.telefono_wa,
  type: 'template',
  template: {
    name: $json.whatsapp_plantilla,
    language: { code: $json.whatsapp_idioma || 'es_CL' },
    ...($json.whatsapp_parametros && $json.whatsapp_parametros.length > 0 ? {
      components: [
        {
          type: 'body',
          parameters: $json.whatsapp_parametros.map((t) => ({ type: 'text', text: String(t ?? '').trim() || '-' }))
        }
      ]
    } : {})
  }
}) }}`,
    options: {
      timeout: 20000,
    },
  };
});

// 7. Fallback Inteligente en PC01
const ifNodeName0 = '¿Template WhatsApp Exitoso?';
const fallbackNodeName0 = 'Enviar WhatsApp (Fallback Texto)';

claude.nodes = claude.nodes.filter((n) => n.name !== ifNodeName0 && n.name !== fallbackNodeName0);

const ifNode0 = {
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'loose',
        version: 2,
      },
      conditions: [
        {
          id: 'cond-template-success',
          leftValue: '={{ !!$json.messages?.[0]?.id }}',
          rightValue: '',
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true,
          },
        },
      ],
      combinator: 'and',
    },
    looseTypeValidation: true,
    options: {},
  },
  id: '7798a1e0-0b87-4489-9518-if-template-ok',
  name: ifNodeName0,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [1150, 880],
};

const fallbackNode0 = {
  parameters: {
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: $('Preparar Mensaje').item.json.telefono_wa,
  type: 'interactive',
  interactive: {
    type: 'button',
    body: {
      text: $('Preparar Mensaje').item.json.whatsapp_texto || ('¡Hola! Tu cita en Peluquería Carolina está confirmada. Código: ' + ($('Preparar Mensaje').item.json.codigo_reserva || ''))
    },
    action: {
      buttons: [
        {
          type: 'reply',
          reply: {
            id: 'btn_reprogramar:' + $('Preparar Mensaje').item.json.reserva_id + ':' + ($('Preparar Mensaje').item.json.codigo_reserva || ''),
            title: 'Reprogramar Cita'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'btn_cancelar:' + $('Preparar Mensaje').item.json.reserva_id + ':' + ($('Preparar Mensaje').item.json.codigo_reserva || ''),
            title: 'Cancelar Cita'
          }
        }
      ]
    }
  }
}) }}`,
    options: {
      timeout: 20000,
    },
  },
  id: 'wa-fallback-http-node',
  name: fallbackNodeName0,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1350, 980],
  onError: 'continueRegularOutput',
  credentials: WA_CREDENTIALS,
};

claude.nodes.push(ifNode0);
claude.nodes.push(fallbackNode0);

claude.connections['Enviar WhatsApp'] = {
  main: [[{ node: ifNodeName0, type: 'main', index: 0 }]],
};
claude.connections[ifNodeName0] = {
  main: [
    [{ node: 'Preparar Registro WhatsApp', type: 'main', index: 0 }],
    [{ node: fallbackNodeName0, type: 'main', index: 0 }],
  ],
};
claude.connections[fallbackNodeName0] = {
  main: [[{ node: 'Preparar Registro WhatsApp', type: 'main', index: 0 }]],
};

// 8. CONFIGURACIÓN EXPERTA EN PC02 (Recordatorio 24H):

// 8.1. Calcular Ventana 24H: dinámico con soporte de pruebas por reserva_id o parámetros manuales
const calcVentana = claude.nodes.find((n) => n.name === 'Calcular Ventana 24H');
if (calcVentana && calcVentana.parameters && calcVentana.parameters.assignments) {
  calcVentana.parameters.assignments.assignments = [
    {
      id: 'd5ff28cb-cd2d-5df9-87b8-bd80a10bce6e',
      name: 'ventana_desde',
      value: "={{ $json.body?.ventana_desde || $json.query?.ventana_desde || $now.setZone('America/Santiago').plus({ hours: 23, minutes: 30 }).toUTC().toISO() }}",
      type: 'string',
    },
    {
      id: '3f07e21c-5b2e-5ad7-bb92-65ab36e282ea',
      name: 'ventana_hasta',
      value: "={{ $json.body?.ventana_hasta || $json.query?.ventana_hasta || $now.setZone('America/Santiago').plus({ hours: 24, minutes: 30 }).toUTC().toISO() }}",
      type: 'string',
    },
    {
      id: 'reserva-id-param',
      name: 'reserva_id',
      value: "={{ $json.body?.reserva_id || $json.query?.reserva_id || '' }}",
      type: 'string',
    },
    {
      id: '3ac9e2c5-4cf2-54c2-99b1-3451b50f964a',
      name: 'zona_horaria',
      value: 'America/Santiago',
      type: 'string',
    },
  ];
}

// 8.2. Buscar Reservas Próximas: filtro para confirmadas y pendientes (y modo test por ID sanitizado contra PostgREST Injection)
const buscarReservas = claude.nodes.find((n) => n.name === 'Buscar Reservas Próximas');
if (buscarReservas && buscarReservas.parameters) {
  buscarReservas.parameters.filterString = "={{ (() => { const rid = String($json.reserva_id || '').trim(); if (rid && /^[A-Za-z0-9_-]{1,64}$/.test(rid)) { return 'id=eq.' + rid; } const d1 = String($json.ventana_desde || '').replace(/[^0-9T:+-Z.]/g, ''); const d2 = String($json.ventana_hasta || '').replace(/[^0-9T:+-Z.]/g, ''); return 'estado=in.(pendiente,confirmada)&fecha_hora_inicio=gte.' + d1 + '&fecha_hora_inicio=lte.' + d2 + '&order=fecha_hora_inicio.asc'; })() }}";
  buscarReservas.notes = 'Busca reservas confirmadas o pendientes cuyo inicio cae en la ventana de 24 horas (o por ID sanitizado en pruebas).';
}

// 8.3. Filtrar Reservas: permitir 'confirmada' y 'pendiente'
const filtrarConfirmadas = claude.nodes.find((n) => n.name === 'Filtrar Reservas Confirmadas');
if (filtrarConfirmadas && filtrarConfirmadas.parameters && filtrarConfirmadas.parameters.conditions) {
  filtrarConfirmadas.parameters.conditions.conditions[0].leftValue = "={{ ['confirmada', 'pendiente'].includes($json.estado) }}";
}

// 8.4. Validar Datos Reserva1: permitir 'confirmada' y 'pendiente'
const validarDatos1 = claude.nodes.find((n) => n.name === 'Validar Datos Reserva1');
if (validarDatos1 && validarDatos1.parameters && validarDatos1.parameters.assignments) {
  const dc = validarDatos1.parameters.assignments.assignments.find((a) => a.name === 'datos_completos');
  if (dc) {
    dc.value = "={{ !!$('Procesar Reservas').item.json.id && !!$('Consultar Cliente1').item.json.id && !!$('Consultar Servicio1').item.json.id && !!$('Consultar Estilista1').item.json.id && !!$('Procesar Reservas').item.json.fecha_hora_inicio && ['confirmada', 'pendiente'].includes($('Procesar Reservas').item.json.estado) && (/^\\d{10,15}$/.test((() => { const d = String($('Consultar Cliente1').item.json.telefono_whatsapp ?? '').replace(/\\D/g, ''); return d.length === 9 ? '56' + d : d; })()) || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String($('Consultar Cliente1').item.json.email ?? '').trim())) }}";
  }
}

// 8.5. Webhook para Trigger manual/test de PC02
const webhookTestName = 'Webhook - Test Recordatorio 24H';
claude.nodes = claude.nodes.filter((n) => n.name !== webhookTestName);
const testWebhookNode = {
  parameters: {
    httpMethod: 'POST',
    path: 'pc02-test-recordatorio',
    responseMode: 'onReceived',
    options: {},
  },
  id: 'webhook-pc02-test-recordatorio',
  webhookId: 'b823df12-5812-4f32-9428-19e07502cd43',
  name: webhookTestName,
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: [304, 2150],
};
claude.nodes.push(testWebhookNode);
claude.connections[webhookTestName] = {
  main: [
    [
      {
        node: 'Calcular Ventana 24H',
        type: 'main',
        index: 0,
      },
    ],
  ],
};

// 8.6. Fallback Inteligente en PC02
const ifNodeName1 = '¿Template Recordatorio Exitoso?';
const fallbackNodeName1 = 'Enviar WhatsApp1 (Fallback Texto)';

claude.nodes = claude.nodes.filter((n) => n.name !== ifNodeName1 && n.name !== fallbackNodeName1);

const ifNode1 = {
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'loose',
        version: 2,
      },
      conditions: [
        {
          id: 'cond-template-success-pc02',
          leftValue: '={{ !!$json.messages?.[0]?.id }}',
          rightValue: '',
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true,
          },
        },
      ],
      combinator: 'and',
    },
    looseTypeValidation: true,
    options: {},
  },
  id: 'wa-if-template-ok-pc02',
  name: ifNodeName1,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [936, 2672],
};

const fallbackNode1 = {
  parameters: {
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: $('Preparar Mensaje1').item.json.telefono_wa,
  type: 'text',
  text: {
    body: $('Preparar Mensaje1').item.json.whatsapp_texto || '¡Hola! Te recordamos tu cita en Peluquería Carolina para mañana.'
  }
}) }}`,
    options: {
      timeout: 20000,
    },
  },
  id: 'wa-fallback-http-node-pc02',
  name: fallbackNodeName1,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [936, 2820],
  onError: 'continueRegularOutput',
  credentials: WA_CREDENTIALS,
};

claude.nodes.push(ifNode1);
claude.nodes.push(fallbackNode1);

claude.connections['Enviar WhatsApp1'] = {
  main: [[{ node: ifNodeName1, type: 'main', index: 0 }]],
};
claude.connections[ifNodeName1] = {
  main: [
    [{ node: 'Preparar Registro WhatsApp1', type: 'main', index: 0 }],
    [{ node: fallbackNodeName1, type: 'main', index: 0 }],
  ],
};
claude.connections[fallbackNodeName1] = {
  main: [[{ node: 'Preparar Registro WhatsApp1', type: 'main', index: 0 }]],
};

// 9. CONFIGURACIÓN EXPERTA EN PC03 (Reserva Cancelación):

// 9.1. Preparar Mensaje2: asegurar idioma es_CL, plantilla cancelacion_reserva, Código de Reserva y email enriquecido
const prep2 = claude.nodes.find((n) => n.name === 'Preparar Mensaje2');
if (prep2 && prep2.parameters && prep2.parameters.assignments) {
  const assignments = prep2.parameters.assignments.assignments;

  upsertAssignment(
    assignments,
    'codigo_reserva',
    `={{ (() => { ${CODE_GEN_FN} return calcCodigo($('Consultar Reserva1').item.json); })() }}`
  );

  upsertAssignment(
    assignments,
    'whatsapp_parametros',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva1').item.json; const COD = calcCodigo(R); const C = $('Consultar Cliente2').item.json; const S = $('Consultar Servicio2').item.json; const F = $('Calcular Fecha y Hora2').item.json; return [ C.nombre_completo, S.nombre + ' (Código: ' + COD + ')', F.fecha_texto, F.hora_texto ]; })() }}`,
    'array'
  );

  upsertAssignment(
    assignments,
    'whatsapp_texto',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva1').item.json; const COD = calcCodigo(R); const C = $('Consultar Cliente2').item.json; const S = $('Consultar Servicio2').item.json; const F = $('Calcular Fecha y Hora2').item.json; return '¡Hola ' + C.nombre_completo + '! Te confirmamos que tu cita en Peluquería Carolina ha sido cancelada.\\n\\n🔖 Código de Reserva cancelada: *' + COD + '*\\n💇 Servicio: ' + S.nombre + '\\n📅 Fecha: ' + F.fecha_texto + '\\n⏰ Hora: ' + F.hora_texto + '\\n\\nEl horario ha sido liberado. Si deseas agendar una nueva hora, puedes hacerlo desde nuestra web. ¡Esperamos atenderte pronto!'; })() }}`
  );

  upsertAssignment(
    assignments,
    'email_asunto',
    `={{ (() => { ${CODE_GEN_FN} const COD = calcCodigo($('Consultar Reserva1').item.json); return 'Cancelación de tu reserva (' + COD + ') - Peluquería Carolina'; })() }}`
  );

  upsertAssignment(
    assignments,
    'email_html',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva1').item.json; const COD = calcCodigo(R); const C = $('Consultar Cliente2').item.json; const S = $('Consultar Servicio2').item.json; const F = $('Calcular Fecha y Hora2').item.json; const e = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222222;max-width:560px"><p>Hola <strong>' + e(C.nombre_completo) + '</strong>,</p><p>Te informamos que tu reserva en <strong>Peluquería Carolina</strong> ha sido cancelada y el horario fue liberado:</p><div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:16px 0;border-radius:6px"><strong>Código de Reserva Cancelada:</strong> <span style="font-family:monospace;font-size:17px;color:#dc2626;font-weight:bold">' + e(COD) + '</span></div><ul><li><strong>Servicio:</strong> ' + e(S.nombre) + '</li><li><strong>Fecha:</strong> ' + e(F.fecha_texto) + '</li><li><strong>Hora:</strong> ' + e(F.hora_texto) + '</li></ul><p>Si deseas agendar una nueva hora, puedes hacerlo desde nuestro sistema de reservas en línea.</p><p>Peluquería Carolina</p></div>'; })() }}`
  );

  let waPl = assignments.find((a) => a.name === 'whatsapp_plantilla');
  if (waPl) waPl.value = 'cancelacion_reserva';

  let waLang = assignments.find((a) => a.name === 'whatsapp_idioma');
  if (waLang) waLang.value = 'es_CL';
}

// 9.2. Fallback Inteligente en PC03
const ifNodeName2 = '¿Template Cancelacion Exitoso?';
const fallbackNodeName2 = 'Enviar WhatsApp2 (Fallback Texto)';

claude.nodes = claude.nodes.filter((n) => n.name !== ifNodeName2 && n.name !== fallbackNodeName2);

const ifNode2 = {
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'loose',
        version: 2,
      },
      conditions: [
        {
          id: 'cond-template-success-pc03',
          leftValue: '={{ !!$json.messages?.[0]?.id }}',
          rightValue: '',
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true,
          },
        },
      ],
      combinator: 'and',
    },
    looseTypeValidation: true,
    options: {},
  },
  id: 'wa-if-template-ok-pc03',
  name: ifNodeName2,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [888, 4672],
};

const fallbackNode2 = {
  parameters: {
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: $('Preparar Mensaje2').item.json.telefono_wa,
  type: 'text',
  text: {
    body: $('Preparar Mensaje2').item.json.whatsapp_texto || '¡Hola! Te informamos que tu cita en Peluquería Carolina ha sido cancelada.'
  }
}) }}`,
    options: {
      timeout: 20000,
    },
  },
  id: 'wa-fallback-http-node-pc03',
  name: fallbackNodeName2,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [888, 4820],
  onError: 'continueRegularOutput',
  credentials: WA_CREDENTIALS,
};

claude.nodes.push(ifNode2);
claude.nodes.push(fallbackNode2);

claude.connections['Enviar WhatsApp2'] = {
  main: [[{ node: ifNodeName2, type: 'main', index: 0 }]],
};
claude.connections[ifNodeName2] = {
  main: [
    [{ node: 'Preparar Registro WhatsApp2', type: 'main', index: 0 }],
    [{ node: fallbackNodeName2, type: 'main', index: 0 }],
  ],
};
claude.connections[fallbackNodeName2] = {
  main: [[{ node: 'Preparar Registro WhatsApp2', type: 'main', index: 0 }]],
};

// 10. CONFIGURACIÓN EXPERTA EN PC04 (Reserva Reprogramación):

// 10.1. Preparar Mensaje3: asegurar idioma es_CL, plantilla reprogramacion_reserva, NUEVO Código de Reserva + 2 Botones
const prep3 = claude.nodes.find((n) => n.name === 'Preparar Mensaje3');
if (prep3 && prep3.parameters && prep3.parameters.assignments) {
  const assignments = prep3.parameters.assignments.assignments;

  upsertAssignment(
    assignments,
    'codigo_reserva',
    `={{ (() => { ${CODE_GEN_FN} return calcCodigo($('Consultar Reserva2').item.json); })() }}`
  );

  upsertAssignment(
    assignments,
    'whatsapp_parametros',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva2').item.json; const COD = calcCodigo(R); const C = $('Consultar Cliente3').item.json; const S = $('Consultar Servicio3').item.json; const E = $('Consultar Estilista2').item.json; const F = $('Obtener Nueva Fecha y Hora').item.json; return [ C.nombre_completo, S.nombre, F.fecha_texto, F.hora_texto, E.nombre + ' | 🔖 Nuevo Código: ' + COD ]; })() }}`,
    'array'
  );

  upsertAssignment(
    assignments,
    'whatsapp_texto',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva2').item.json; const COD = calcCodigo(R); const TOK = $('Validar Payload2').item.json.gestion_token || ''; const C = $('Consultar Cliente3').item.json; const S = $('Consultar Servicio3').item.json; const E = $('Consultar Estilista2').item.json; const F = $('Obtener Nueva Fecha y Hora').item.json; const urlReprog = buildManageUrl(COD, 'reprogramar', TOK); const urlCancel = buildManageUrl(COD, 'cancelar', TOK); return '¡Hola ' + C.nombre_completo + '! ✨ Te informamos que tu cita en Peluquería Carolina ha sido reprogramada con éxito.\\n\\n💇 Servicio: ' + S.nombre + '\\n👤 Profesional: ' + E.nombre + '\\n🔖 Nuevo Código de Reserva: *' + COD + '*\\n📅 Nueva Fecha: ' + F.fecha_texto + '\\n⏰ Nueva Hora: ' + F.hora_texto + '\\n\\nGestiona tu cita con los botones o en 1 clic:\\n🔄 Reprogramar: ' + urlReprog + '\\n❌ Cancelar: ' + urlCancel; })() }}`
  );

  upsertAssignment(
    assignments,
    'email_asunto',
    `={{ (() => { ${CODE_GEN_FN} const COD = calcCodigo($('Consultar Reserva2').item.json); return 'Reserva reprogramada (Nuevo Código: ' + COD + ') - Peluquería Carolina'; })() }}`
  );

  upsertAssignment(
    assignments,
    'email_html',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva2').item.json; const COD = calcCodigo(R); const TOK = $('Validar Payload2').item.json.gestion_token || ''; const C = $('Consultar Cliente3').item.json; const S = $('Consultar Servicio3').item.json; const E = $('Consultar Estilista2').item.json; const F = $('Obtener Nueva Fecha y Hora').item.json; const e = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); const urlReprog = buildManageUrl(COD, 'reprogramar', TOK); const urlCancel = buildManageUrl(COD, 'cancelar', TOK); return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222222;max-width:560px"><p>Hola <strong>' + e(C.nombre_completo) + '</strong>,</p><p>Tu reserva en <strong>Peluquería Carolina</strong> fue reprogramada con éxito. Se ha emitido un nuevo código para tu cita:</p><div style="background:#f8f5f0;border-left:4px solid #8a5a44;padding:12px 16px;margin:16px 0;border-radius:6px"><strong>Nuevo Código de Reserva:</strong> <span style="font-family:monospace;font-size:17px;color:#8a5a44;font-weight:bold">' + e(COD) + '</span></div><ul><li><strong>Servicio:</strong> ' + e(S.nombre) + '</li><li><strong>Profesional:</strong> ' + e(E.nombre) + '</li><li><strong>Nuevo Código de Reserva:</strong> ' + e(COD) + '</li><li><strong>Nueva fecha:</strong> ' + e(F.fecha_texto) + '</li><li><strong>Nueva hora:</strong> ' + e(F.hora_texto) + '</li></ul><div style="margin:18px 0"><a href="' + e(urlReprog) + '" style="display:inline-block;background:#8a5a44;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;margin-right:10px">📅 Reprogramar Cita</a><a href="' + e(urlCancel) + '" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">❌ Cancelar Cita</a></div><p>Peluquería Carolina</p></div>'; })() }}`
  );

  let waPl = assignments.find((a) => a.name === 'whatsapp_plantilla');
  if (waPl) waPl.value = 'reprogramacion_reserva';

  let waLang = assignments.find((a) => a.name === 'whatsapp_idioma');
  if (waLang) waLang.value = 'es_CL';
}

// 10.2. Fallback Inteligente en PC04
const ifNodeName3 = '¿Template Reprogramacion Exitoso?';
const fallbackNodeName3 = 'Enviar WhatsApp3 (Fallback Texto)';

claude.nodes = claude.nodes.filter((n) => n.name !== ifNodeName3 && n.name !== fallbackNodeName3);

const ifNode3 = {
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'loose',
        version: 2,
      },
      conditions: [
        {
          id: 'cond-template-success-pc04',
          leftValue: '={{ !!$json.messages?.[0]?.id }}',
          rightValue: '',
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true,
          },
        },
      ],
      combinator: 'and',
    },
    looseTypeValidation: true,
    options: {},
  },
  id: 'wa-if-template-ok-pc04',
  name: ifNodeName3,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [856, 6656],
};

const fallbackNode3 = {
  parameters: {
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: $('Preparar Mensaje3').item.json.telefono_wa,
  type: 'interactive',
  interactive: {
    type: 'button',
    body: {
      text: $('Preparar Mensaje3').item.json.whatsapp_texto || ('¡Hola! Tu cita en Peluquería Carolina ha sido reprogramada. Nuevo código: ' + ($('Preparar Mensaje3').item.json.codigo_reserva || ''))
    },
    action: {
      buttons: [
        {
          type: 'reply',
          reply: {
            id: 'btn_reprogramar:' + $('Preparar Mensaje3').item.json.reserva_id + ':' + ($('Preparar Mensaje3').item.json.codigo_reserva || ''),
            title: 'Reprogramar Cita'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'btn_cancelar:' + $('Preparar Mensaje3').item.json.reserva_id + ':' + ($('Preparar Mensaje3').item.json.codigo_reserva || ''),
            title: 'Cancelar Cita'
          }
        }
      ]
    }
  }
}) }}`,
    options: {
      timeout: 20000,
    },
  },
  id: 'wa-fallback-http-node-pc04',
  name: fallbackNodeName3,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [856, 6800],
  onError: 'continueRegularOutput',
  credentials: WA_CREDENTIALS,
};

claude.nodes.push(ifNode3);
claude.nodes.push(fallbackNode3);

claude.connections['Enviar WhatsApp3'] = {
  main: [[{ node: ifNodeName3, type: 'main', index: 0 }]],
};
claude.connections[ifNodeName3] = {
  main: [
    [{ node: 'Preparar Registro WhatsApp3', type: 'main', index: 0 }],
    [{ node: fallbackNodeName3, type: 'main', index: 0 }],
  ],
};
claude.connections[fallbackNodeName3] = {
  main: [[{ node: 'Preparar Registro WhatsApp3', type: 'main', index: 0 }]],
};

// 11. CONFIGURACIÓN EXPERTA EN PC05 (Reserva Seguimiento / Encuesta al Confirmar en Admin o Atender):

// 11.0. Permitir estado 'confirmada' (confirmación desde Panel Admin) y 'atendida' en PC05 y PC08
const estadoAtendidaNode = claude.nodes.find((n) => n.name === '¿Estado Atendida?');
if (estadoAtendidaNode && estadoAtendidaNode.parameters && estadoAtendidaNode.parameters.conditions) {
  estadoAtendidaNode.parameters.conditions.conditions[0].leftValue = "={{ ['confirmada', 'atendida'].includes($json.estado) }}";
}

const validarDatos4 = claude.nodes.find((n) => n.name === 'Validar Datos Reserva4');
if (validarDatos4 && validarDatos4.parameters && validarDatos4.parameters.assignments) {
  const dc4 = validarDatos4.parameters.assignments.assignments.find((a) => a.name === 'datos_completos');
  if (dc4) {
    dc4.value = "={{ !!$('Consultar Reserva3').item.json.id && !!$('Consultar Cliente4').item.json.id && !!$('Consultar Servicio4').item.json.id && !!$('Consultar Reserva3').item.json.fecha_hora_inicio && ['confirmada', 'atendida'].includes($('Consultar Reserva3').item.json.estado) && (/^\\d{10,15}$/.test((() => { const d = String($('Consultar Cliente4').item.json.telefono_whatsapp ?? '').replace(/\\D/g, ''); return d.length === 9 ? '56' + d : d; })()) || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String($('Consultar Cliente4').item.json.email ?? '').trim())) }}";
  }
}

const reservaAtendidaPc08 = claude.nodes.find((n) => n.name === '¿Reserva Atendida?');
if (reservaAtendidaPc08 && reservaAtendidaPc08.parameters && reservaAtendidaPc08.parameters.conditions) {
  reservaAtendidaPc08.parameters.conditions.conditions[0].leftValue = "={{ ['confirmada', 'atendida'].includes($json.estado) }}";
}

// 11.1. Generar Enlace Encuesta: enlace a plataforma web con código de verificación PC-XX-XXXX
const genEnlace = claude.nodes.find((n) => n.name === 'Generar Enlace Encuesta');
if (genEnlace && genEnlace.parameters && genEnlace.parameters.assignments) {
  const enc = genEnlace.parameters.assignments.assignments.find((a) => a.name === 'enlace_encuesta');
  if (enc) {
    enc.value = `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva3').item.json; const COD = calcCodigo(R); return 'http://localhost:3000/encuesta?reserva=' + encodeURIComponent(COD) + '&reserva_id=' + encodeURIComponent(String(R.id)); })() }}`;
  }
}

// 11.2. Preparar Mensaje4: asegurar idioma es_CL, plantilla seguimiento_encuesta, código de reserva y mensaje + link en WhatsApp y Gmail
const prep4 = claude.nodes.find((n) => n.name === 'Preparar Mensaje4');
if (prep4 && prep4.parameters && prep4.parameters.assignments) {
  const assignments = prep4.parameters.assignments.assignments;

  upsertAssignment(
    assignments,
    'codigo_reserva',
    `={{ (() => { ${CODE_GEN_FN} return calcCodigo($('Consultar Reserva3').item.json); })() }}`
  );

  upsertAssignment(
    assignments,
    'whatsapp_parametros',
    `={{ (() => { const C = $('Consultar Cliente4').item.json; const S = $('Consultar Servicio4').item.json; const F = $('Generar Enlace Encuesta').item.json; return [ C.nombre_completo, S.nombre, F.enlace_encuesta ]; })() }}`,
    'array'
  );

  const waTextVal = `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva3').item.json; const COD = calcCodigo(R); const C = $('Consultar Cliente4').item.json; const S = $('Consultar Servicio4').item.json; const F = $('Generar Enlace Encuesta').item.json; return '¡Hola ' + C.nombre_completo + '! ✨ Tu reserva (' + COD + ') en Peluquería Carolina para el servicio de *' + S.nombre + '* ha sido confirmada.\\n\\nTu opinión es muy importante para seguir mejorando. ¿Nos ayudarías respondiendo una breve encuesta de satisfacción?\\n\\n👉 Responde tu encuesta aquí: ' + F.enlace_encuesta + '\\n\\n¡Esperamos verte pronto!'; })() }}`;
  upsertAssignment(assignments, 'whatsapp_texto', waTextVal);

  upsertAssignment(
    assignments,
    'email_asunto',
    `={{ (() => { ${CODE_GEN_FN} const COD = calcCodigo($('Consultar Reserva3').item.json); return 'Encuesta de Satisfacción - Reserva Confirmada (' + COD + ') - Peluquería Carolina'; })() }}`
  );

  upsertAssignment(
    assignments,
    'email_html',
    `={{ (() => { ${CODE_GEN_FN} const R = $('Consultar Reserva3').item.json; const COD = calcCodigo(R); const C = $('Consultar Cliente4').item.json; const S = $('Consultar Servicio4').item.json; const F = $('Generar Enlace Encuesta').item.json; const e = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222;max-width:560px"><p>Hola <strong>' + e(C.nombre_completo) + '</strong>,</p><p>Tu reserva en <strong>Peluquería Carolina</strong> para el servicio <strong>' + e(S.nombre) + '</strong> ha sido confirmada por nuestra administración.</p><div style="background:#f8f5f0;border-left:4px solid #8a5a44;padding:12px 16px;margin:16px 0;border-radius:6px"><strong>Código de Reserva:</strong> <span style="font-family:monospace;font-size:17px;color:#8a5a44;font-weight:bold">' + e(COD) + '</span></div><p>Tu opinión es muy importante para nosotros. Te invitamos a responder nuestra breve <strong>encuesta de satisfacción</strong> (puntaje de 1 a 5) en el siguiente enlace:</p><div style="margin:20px 0"><a href="' + e(F.enlace_encuesta) + '" style="display:inline-block;background:#8a5a44;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">⭐ Responder Encuesta de Satisfacción</a></div><p style="font-size:13px;color:#555555">Enlace directo a la encuesta:<br><a href="' + e(F.enlace_encuesta) + '" style="color:#8a5a44">' + e(F.enlace_encuesta) + '</a></p><p>¡Gracias por preferirnos!<br><strong>Peluquería Carolina</strong></p></div>'; })() }}`
  );

  let waPl = assignments.find((a) => a.name === 'whatsapp_plantilla');
  if (waPl) waPl.value = 'seguimiento_encuesta';

  let waLang = assignments.find((a) => a.name === 'whatsapp_idioma');
  if (waLang) waLang.value = 'es_CL';
}

// 11.3. Fallback Inteligente en PC05
const ifNodeName4 = '¿Template Seguimiento Exitoso?';
const fallbackNodeName4 = 'Enviar WhatsApp4 (Fallback Texto)';

claude.nodes = claude.nodes.filter((n) => n.name !== ifNodeName4 && n.name !== fallbackNodeName4);

const ifNode4 = {
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'loose',
        version: 2,
      },
      conditions: [
        {
          id: 'cond-template-success-pc05',
          leftValue: '={{ !!$json.messages?.[0]?.id }}',
          rightValue: '',
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true,
          },
        },
      ],
      combinator: 'and',
    },
    looseTypeValidation: true,
    options: {},
  },
  id: 'wa-if-template-ok-pc05',
  name: ifNodeName4,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [8184, 768],
};

const fallbackNode4 = {
  parameters: {
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: $('Preparar Mensaje4').item.json.telefono_wa,
  type: 'text',
  text: {
    body: $('Preparar Mensaje4').item.json.whatsapp_texto || '¡Hola! Muchas gracias por visitarnos en Peluquería Carolina. Tu opinión es muy importante para nosotros.'
  }
}) }}`,
    options: {
      timeout: 20000,
    },
  },
  id: 'wa-fallback-http-node-pc05',
  name: fallbackNodeName4,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [8184, 920],
  onError: 'continueRegularOutput',
  credentials: WA_CREDENTIALS,
};

claude.nodes.push(ifNode4);
claude.nodes.push(fallbackNode4);

claude.connections['Enviar WhatsApp4'] = {
  main: [[{ node: ifNodeName4, type: 'main', index: 0 }]],
};
claude.connections[ifNodeName4] = {
  main: [
    [{ node: 'Preparar Registro WhatsApp4', type: 'main', index: 0 }],
    [{ node: fallbackNodeName4, type: 'main', index: 0 }],
  ],
};
claude.connections[fallbackNodeName4] = {
  main: [[{ node: 'Preparar Registro WhatsApp4', type: 'main', index: 0 }]],
};

// 12. CONFIGURACIÓN EXPERTA EN PC06 (Sistema Webhook Router):

// 12.0. SOPORTE DE NOMENCLATURA DUAL Y NORMALIZACIÓN DE ALIAS EN PC06 Y SUB-WORKFLOWS:

// Normalizar sub-workflows para aceptar tanto nombres en español como en inglés estándar
const subWorkflowValidations = [
  {
    name: 'Validar Payload', // PC01
    validEvents: ['reserva_creada', 'booking.created', 'booking_created'],
  },
  {
    name: 'Validar Payload1', // PC03
    validEvents: ['reserva_cancelada', 'booking.cancelled', 'booking_cancelled', 'booking.canceled', 'booking_canceled'],
  },
  {
    name: 'Validar Payload2', // PC04
    validEvents: ['reserva_reprogramada', 'booking.updated', 'booking_updated', 'booking.rescheduled', 'booking_rescheduled'],
  },
  {
    name: 'Validar Payload3', // PC05
    validEvents: [
      'reserva_confirmada',
      'booking.confirmed',
      'booking_confirmed',
      'reserva_atendida',
      'booking.completed',
      'booking_completed',
      'booking.attended',
      'booking_attended',
    ],
  },
];

subWorkflowValidations.forEach((sw) => {
  const node = claude.nodes.find((n) => n.name === sw.name);
  if (node && node.parameters && node.parameters.assignments) {
    const assignments = node.parameters.assignments.assignments;
    const pVal = assignments.find((a) => a.name === 'payload_valido');
    const pRes = assignments.find((a) => a.name === 'reserva_id');
    const evList = JSON.stringify(sw.validEvents);

    if (pVal) {
      pVal.value = `={{ ${evList}.includes(String(($json.body ?? $json).evento ?? ($json.body ?? $json).event ?? '').trim().toLowerCase()) && /^[A-Za-z0-9_-]{1,64}$/.test(String(($json.body ?? $json).reserva_id ?? ($json.body ?? $json).booking_id ?? ($json.body ?? $json).id ?? '').trim()) }}`;
    }
    if (pRes) {
      pRes.value = `={{ String(($json.body ?? $json).reserva_id ?? ($json.body ?? $json).booking_id ?? ($json.body ?? $json).id ?? '').trim() }}`;
    }
    upsertAssignment(
      assignments,
      'gestion_token',
      `={{ String(($json.body ?? $json).gestion_token ?? '').trim() }}`
    );
  }
});

// Actualizar Validar Payload4 en PC06 Router (regex extendida + normalización de alias)
const valNode4 = claude.nodes.find((n) => n.name === 'Validar Payload4');
if (valNode4 && valNode4.parameters && valNode4.parameters.assignments) {
  valNode4.parameters.assignments.assignments = [
    {
      id: '0ce7edda-9c59-52b0-84a6-b188bd132b40',
      name: 'evento',
      value: `={{
  (() => {
    const rawBody = $json.body ?? $json;
    const rawEvt = String(rawBody.evento ?? rawBody.event ?? '').trim().toLowerCase();
    const aliasMap = {
      'booking.created': 'reserva_creada',
      'booking_created': 'reserva_creada',
      'booking.updated': 'reserva_reprogramada',
      'booking_updated': 'reserva_reprogramada',
      'booking.rescheduled': 'reserva_reprogramada',
      'booking_rescheduled': 'reserva_reprogramada',
      'booking.cancelled': 'reserva_cancelada',
      'booking_cancelled': 'reserva_cancelada',
      'booking.canceled': 'reserva_cancelada',
      'booking_canceled': 'reserva_cancelada',
      'reserva_confirmada': 'reserva_atendida',
      'booking.confirmed': 'reserva_atendida',
      'booking_confirmed': 'reserva_atendida',
      'booking.completed': 'reserva_atendida',
      'booking_completed': 'reserva_atendida',
      'booking.attended': 'reserva_atendida',
      'booking_attended': 'reserva_atendida',
      'chat.message': 'consulta_chat',
      'chat_message': 'consulta_chat',
      'chat.query': 'consulta_chat',
      'survey.submitted': 'encuesta_respondida',
      'survey_submitted': 'encuesta_respondida',
      'feedback.submitted': 'encuesta_respondida'
    };
    return aliasMap[rawEvt] || rawEvt;
  })()
}}`,
      type: 'string',
    },
    {
      id: 'b4c43bff-b63a-51f2-b64e-b12602ca9148',
      name: 'body',
      value: `={{
  (() => {
    const rawBody = $json.body ?? $json;
    const rawEvt = String(rawBody.evento ?? rawBody.event ?? '').trim().toLowerCase();
    const aliasMap = {
      'booking.created': 'reserva_creada',
      'booking_created': 'reserva_creada',
      'booking.updated': 'reserva_reprogramada',
      'booking_updated': 'reserva_reprogramada',
      'booking.rescheduled': 'reserva_reprogramada',
      'booking_rescheduled': 'reserva_reprogramada',
      'booking.cancelled': 'reserva_cancelada',
      'booking_cancelled': 'reserva_cancelada',
      'booking.canceled': 'reserva_cancelada',
      'booking_canceled': 'reserva_cancelada',
      'reserva_confirmada': 'reserva_atendida',
      'booking.confirmed': 'reserva_atendida',
      'booking_confirmed': 'reserva_atendida',
      'booking.completed': 'reserva_atendida',
      'booking_completed': 'reserva_atendida',
      'booking.attended': 'reserva_atendida',
      'booking_attended': 'reserva_atendida',
      'chat.message': 'consulta_chat',
      'chat_message': 'consulta_chat',
      'chat.query': 'consulta_chat',
      'survey.submitted': 'encuesta_respondida',
      'survey_submitted': 'encuesta_respondida',
      'feedback.submitted': 'encuesta_respondida'
    };
    const canonical = aliasMap[rawEvt] || rawEvt;
    return Object.assign({}, rawBody, {
      evento: canonical,
      evento_original: rawEvt,
      reserva_id: String(rawBody.reserva_id || rawBody.booking_id || rawBody.id || '')
    });
  })()
}}`,
      type: 'object',
    },
    {
      id: 'f84184b3-978c-5455-964d-d6e16f541697',
      name: 'payload_valido',
      value: `={{
  (() => {
    const rawBody = $json.body ?? $json;
    const rawEvt = String(rawBody.evento ?? rawBody.event ?? '').trim();
    if (!rawEvt) return false;
    return /^[a-z0-9_.-]{1,64}$/i.test(rawEvt);
  })()
}}`,
      type: 'boolean',
    },
  ];
}

// Actualizar condiciones en Identificar Evento (Switch v3.2) para aceptar tanto nombres canónicos como alias
const switchNode = claude.nodes.find((n) => n.name === 'Identificar Evento');
if (switchNode && switchNode.parameters && switchNode.parameters.rules && switchNode.parameters.rules.values) {
  const rules = switchNode.parameters.rules.values;
  const eventRuleMap = [
    { outputKey: 'reserva_creada', matches: ['reserva_creada', 'booking.created', 'booking_created'] },
    { outputKey: 'reserva_cancelada', matches: ['reserva_cancelada', 'booking.cancelled', 'booking_cancelled', 'booking.canceled', 'booking_canceled'] },
    { outputKey: 'reserva_reprogramada', matches: ['reserva_reprogramada', 'booking.updated', 'booking_updated', 'booking.rescheduled', 'booking_rescheduled'] },
    { outputKey: 'reserva_atendida', matches: ['reserva_atendida', 'reserva_confirmada', 'booking.confirmed', 'booking_confirmed', 'booking.completed', 'booking_completed', 'booking.attended', 'booking_attended'] },
    { outputKey: 'consulta_chat', matches: ['consulta_chat', 'chat.message', 'chat_message', 'chat.query'] },
    { outputKey: 'encuesta_respondida', matches: ['encuesta_respondida', 'survey.submitted', 'survey_submitted', 'feedback.submitted'] },
  ];

  eventRuleMap.forEach((erm, idx) => {
    if (rules[idx]) {
      rules[idx].renameOutput = true;
      rules[idx].outputKey = erm.outputKey;
      rules[idx].conditions = {
        options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 2 },
        combinator: 'or',
        conditions: erm.matches.map((val) => ({
          id: `cond-${erm.outputKey}-${val.replace(/[^a-z0-9]/gi, '_')}`,
          leftValue: '={{ $json.evento }}',
          rightValue: val,
          operator: { type: 'string', operation: 'equals' },
        })),
      };
    }
  });
}

// 12.1. Nodos de despacho HTTP hacia los webhooks especializados
const dispatchEndpoints = [
  { name: 'Despachar Reserva Creada', path: 'pc01-reserva-confirmacion', posY: 1750 },
  { name: 'Despachar Reserva Cancelada', path: 'pc03-reserva-cancelacion', posY: 1880 },
  { name: 'Despachar Reserva Reprogramada', path: 'pc04-reserva-reprogramacion', posY: 2010 },
  { name: 'Despachar Reserva Atendida', path: 'pc05-reserva-seguimiento', posY: 2140 },
  { name: 'Despachar Consulta Chat', path: 'pc07-asistente-gemini', posY: 2270 },
  { name: 'Despachar Encuesta Respondida', path: 'pc08-encuesta-respuesta', posY: 2400 },
];

const dispatchNames = dispatchEndpoints.map((d) => d.name);
claude.nodes = claude.nodes.filter((n) => !dispatchNames.includes(n.name));

const dispatchNodes = dispatchEndpoints.map((d) => ({
  parameters: {
    method: 'POST',
    url: `http://localhost:5678/webhook/${d.path}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'Content-Type', value: 'application/json' }],
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.body || $json) }}',
    options: {
      timeout: 30000,
    },
  },
  id: `dispatch-${d.path}`,
  name: d.name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [8600, d.posY],
  onError: 'continueRegularOutput',
}));

claude.nodes.push(...dispatchNodes);

// 12.2. Conectar Identificar Evento (Switch v3.2) a los 6 despachos + fallback
claude.connections['Identificar Evento'] = {
  main: [
    [{ node: 'Despachar Reserva Creada', type: 'main', index: 0 }],
    [{ node: 'Despachar Reserva Cancelada', type: 'main', index: 0 }],
    [{ node: 'Despachar Reserva Reprogramada', type: 'main', index: 0 }],
    [{ node: 'Despachar Reserva Atendida', type: 'main', index: 0 }],
    [{ node: 'Despachar Consulta Chat', type: 'main', index: 0 }],
    [{ node: 'Despachar Encuesta Respondida', type: 'main', index: 0 }],
    [{ node: 'Resultado - Evento Desconocido', type: 'main', index: 0 }],
  ],
};

// 12.3. Conectar cada despacho a Normalizar Respuesta
dispatchEndpoints.forEach((d) => {
  claude.connections[d.name] = {
    main: [[{ node: 'Normalizar Respuesta', type: 'main', index: 0 }]],
  };
});

// 12.4. Mejorar Normalizar Respuesta para soportar objetos y strings en error
const normNode = claude.nodes.find((n) => n.name === 'Normalizar Respuesta');
if (normNode && normNode.parameters && normNode.parameters.assignments) {
  normNode.parameters.assignments.assignments = [
    {
      id: '8143fb57-cea2-54b8-8db9-fcf82f2de336',
      name: 'success',
      value: '={{ $json.success === true }}',
      type: 'boolean',
    },
    {
      id: '2c758e50-03ac-557b-adb0-289476d55808',
      name: 'error',
      value: "={{ $json.error ? (typeof $json.error === 'object' ? ($json.error.message || JSON.stringify($json.error)) : String($json.error)) : '' }}",
      type: 'string',
    },
    {
      id: 'd716850a-bbf8-588b-9e77-cf2e8f076281',
      name: 'http_status',
      value: '={{ $json.http_status ?? ($json.success === true ? 200 : ($json.error ? 400 : 500)) }}',
      type: 'number',
    },
    {
      id: '4f627462-34fd-5f36-ba5e-4dbe9d36e416',
      name: 'respuesta',
      value: "={{ $json.respuesta ?? '' }}",
      type: 'string',
    },
  ];
}

// 13. CONFIGURACIÓN EXPERTA EN PC07 (Asistente Gemini):
// Credencial cifrada creada con setup_gemini_credential.js (header x-goog-api-key).
const geminiNode = claude.nodes.find((n) => n.name === 'Consultar Gemini');
if (geminiNode) {
  geminiNode.parameters.authentication = 'genericCredentialType';
  geminiNode.parameters.genericAuthType = 'httpHeaderAuth';
  geminiNode.credentials = {
    httpHeaderAuth: { id: 'gemini0apikey0001', name: 'Gemini API Key' },
  };
  // temperature baja: respuestas fieles al contexto del negocio (menos invención)
  geminiNode.parameters.jsonBody = geminiNode.parameters.jsonBody.replace(
    "generationConfig: { maxOutputTokens: 2048,",
    'generationConfig: { temperature: 0.3, maxOutputTokens: 2048,'
  );
}

// 14. Guardar archivo parcheado
fs.writeFileSync('./n8n/workflows/claude_patched.json', JSON.stringify(claude, null, 2), 'utf8');
console.log('✅ Guardado en ./n8n/workflows/claude_patched.json con PC01 + PC02 + PC03 + PC04 + PC05 + PC06 completamente configurados y resilientes.');





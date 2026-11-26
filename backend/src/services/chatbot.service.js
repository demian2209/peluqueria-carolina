const crypto = require('crypto');
const supabase = require('../database/supabaseClient');

/**
 * Servicio del historial del chatbot.
 *
 * - Catálogo cerrado de categorías (espejo de public.chatbot_categorias_validas() en Supabase).
 * - Clasificador heurístico de respaldo por palabras clave (espejo del nodo "Clasificar Categorías" de n8n).
 * - Persistencia directa y atómica en Supabase mediante la RPC `registrar_interaccion_chatbot`
 *   (usando service_role), con respaldo por tablas directas, webhook n8n (PC07) y memoria en modo mock.
 */

const CATEGORIAS_CHATBOT = [
  'servicios',
  'precios',
  'horarios',
  'estilistas',
  'reservar_hora',
  'cancelar_reprogramar',
  'ubicacion_contacto',
  'faqs',
  'otros',
];

const SESSION_ID_REGEX = /^[A-Za-z0-9_-]{8,100}$/;

const normalizarTexto = (txt = '') =>
  String(txt)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Palabras clave por categoría (sobre texto sin tildes y en minúsculas)
const REGLAS_PALABRAS_CLAVE = [
  ['precios', /(precio|valor(es)?\b|cuesta|cuanto sale|cuanto vale|tarifa|costo|cobran|\$)/],
  ['horarios', /(horario|abierto|abren|abre\b|cierran|cierra\b|atienden|atiende|a que hora|hasta que hora|domingo|sabado|feriado)/],
  ['reservar_hora', /(reservar|agendar|nueva cita|sacar (una )?(hora|cita)|quiero (una )?(hora|cita)|hora para|disponibilidad|turno|pedir hora|tomar hora)/],
  ['cancelar_reprogramar', /(cancelar|anular|reprogramar|cambiar (mi )?(hora|cita)|mover (mi )?(hora|cita))/],
  ['estilistas', /(estilista|peluquer[oa]|barbero|profesional|quien (realiza|hace|atiende)|carolina|matias|camila|gonzalo|valentina|equipo)/],
  ['servicios', /(servicio|corte|balayage|coloracion|tinte|alisado|botox|manicur|barba|peinado|tratamiento|k18|olaplex|fade|masaje|brushing|lavado|cuanto (demora|dura|tarda))/],
  ['ubicacion_contacto', /(direccion|ubicacion|donde (esta|queda)|como llegar|telefono|whatsapp|contacto|instagram|correo|san fernando|mapa)/],
  ['faqs', /(medios? de pago|pagar|pago\b|tarjeta|cuotas|efectivo|transferencia|preparar|prepararme|politica|recargo|anticipacion)/],
];

/**
 * Clasifica un texto por palabras clave. Devuelve [] si no hay coincidencias.
 */
const clasificarPorPalabrasClave = (texto = '') => {
  const norm = normalizarTexto(texto);
  return REGLAS_PALABRAS_CLAVE.filter(([, re]) => re.test(norm)).map(([cat]) => cat);
};

/**
 * Filtra contra el catálogo, deduplica, ordena y garantiza al menos ['otros'].
 * Si `categorias` no aporta ninguna categoría válida, usa el clasificador heurístico sobre `textoRespaldo`.
 */
const normalizarCategorias = (categorias, textoRespaldo = '') => {
  let cats = (Array.isArray(categorias) ? categorias : [])
    .map((c) => normalizarTexto(c).trim())
    .filter((c) => CATEGORIAS_CHATBOT.includes(c));

  if (cats.length === 0 && textoRespaldo) {
    cats = clasificarPorPalabrasClave(textoRespaldo);
  }

  cats = [...new Set(cats)].sort();
  if (cats.length > 1) cats = cats.filter((c) => c !== 'otros');
  if (cats.length === 0) cats = ['otros'];
  return cats;
};

/**
 * Valida el session_id enviado por el cliente; si es inválido o falta, genera uno anónimo.
 */
const resolverSessionId = (valor) => {
  const candidato = typeof valor === 'string' ? valor.trim() : '';
  if (SESSION_ID_REGEX.test(candidato)) return candidato;
  return `anon-${crypto.randomUUID()}`;
};

/**
 * URL del webhook n8n que registra interacciones (PC07 - registrar chat).
 * Se deriva de N8N_ASISTENTE_URL / N8N_WEBHOOK_URL salvo que exista N8N_REGISTRO_CHAT_URL.
 */
const resolverUrlRegistroChat = () => {
  if (process.env.N8N_REGISTRO_CHAT_URL) return process.env.N8N_REGISTRO_CHAT_URL;
  const raw =
    process.env.N8N_ASISTENTE_URL ||
    process.env.N8N_WEBHOOK_URL ||
    'http://localhost:5678/webhook/pc07-asistente-gemini';
  const url = raw.replace(
    /\/webhook\/(pc06-webhook-router|pc07-asistente-gemini)/,
    '/webhook/pc07-registrar-chat'
  );
  return url.includes('/webhook/pc07-registrar-chat') ? url : null;
};

const HORARIO_NEGOCIO_DEFAULT = {
  0: { abierto: true, apertura: 10 * 60, cierre: 18 * 60 }, // Domingo 10:00–18:00
  1: { abierto: true, apertura: 9 * 60, cierre: 19 * 60 },  // Lunes
  2: { abierto: true, apertura: 9 * 60, cierre: 19 * 60 },  // Martes
  3: { abierto: true, apertura: 9 * 60, cierre: 19 * 60 },  // Miércoles
  4: { abierto: true, apertura: 9 * 60, cierre: 19 * 60 },  // Jueves
  5: { abierto: true, apertura: 9 * 60, cierre: 19 * 60 },  // Viernes
  6: { abierto: true, apertura: 9 * 60, cierre: 19 * 60 },  // Sábado
};

/**
 * Evalúa si un timestamp ISO cae fuera del horario laboral en America/Santiago.
 * Espejo de public.es_fuera_horario_laboral() para respaldos directos / modo mock.
 */
const esFueraHorarioLaboralChile = (isoTimestamp) => {
  const dt = new Date(isoTimestamp || Date.now());
  if (isNaN(dt.getTime())) return false;
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Santiago',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .formatToParts(dt)
        .map((p) => [p.type, p.value])
    );
    const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dowMap[parts.weekday] ?? 1;
    const cfg = HORARIO_NEGOCIO_DEFAULT[dow];
    if (!cfg || !cfg.abierto) return true;
    const mins = (Number(parts.hour) % 24) * 60 + Number(parts.minute || 0);
    return !(mins >= cfg.apertura && mins < cfg.cierre);
  } catch (_) {
    return false;
  }
};

// Store en memoria solo para entornos sin Supabase configurado (modo mock)
const conversacionesMockMap = new Map();
let mockMsgSeq = 1;

const registrarInteraccionEnMemoria = ({
  session_id,
  mensaje,
  respuesta,
  categorias,
  canal,
  origen,
  timestamp,
}) => {
  const fuera = esFueraHorarioLaboralChile(timestamp);
  const tsBot = new Date(new Date(timestamp).getTime() + 1).toISOString();
  let conv = conversacionesMockMap.get(session_id);

  if (!conv) {
    conv = {
      id: crypto.randomUUID(),
      session_id,
      canal,
      categorias: [...categorias],
      total_mensajes: 2,
      fuera_horario_laboral: fuera,
      iniciada_en: timestamp,
      ultima_interaccion_en: timestamp,
      resumen: mensaje.slice(0, 160),
      metadata: {},
      mensajes: [],
    };
    conversacionesMockMap.set(session_id, conv);
  } else {
    conv.categorias = normalizarCategorias([...conv.categorias, ...categorias]);
    conv.total_mensajes += 2;
    if (timestamp > conv.ultima_interaccion_en) {
      conv.ultima_interaccion_en = timestamp;
    }
  }

  conv.mensajes.push(
    {
      id: mockMsgSeq++,
      conversacion_id: conv.id,
      rol: 'usuario',
      contenido: mensaje,
      categorias_detectadas: [...categorias],
      fuera_horario_laboral: fuera,
      origen,
      creado_en: timestamp,
    },
    {
      id: mockMsgSeq++,
      conversacion_id: conv.id,
      rol: 'asistente',
      contenido: respuesta,
      categorias_detectadas: [],
      fuera_horario_laboral: fuera,
      origen,
      creado_en: tsBot,
    }
  );

  return {
    conversacion_id: conv.id,
    categorias: conv.categorias,
    fuera_horario_laboral: fuera,
    conversacion_fuera_horario_laboral: conv.fuera_horario_laboral,
  };
};

const esErrorRpcInexistente = (error) => {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    (msg.includes('function') && msg.includes('does not exist'))
  );
};

/**
 * Fallback directo sobre tablas si la RPC `registrar_interaccion_chatbot` no estuviera disponible.
 */
const registrarInteraccionTablasDirecto = async ({
  session_id,
  mensaje,
  respuesta,
  categorias,
  canal,
  origen,
  timestamp,
}) => {
  const fuera = esFueraHorarioLaboralChile(timestamp);
  const tsBot = new Date(new Date(timestamp).getTime() + 1).toISOString();

  const { data: existente, error: selErr } = await supabase
    .from('chatbot_conversaciones')
    .select('id, categorias, total_mensajes, fuera_horario_laboral, ultima_interaccion_en')
    .eq('session_id', session_id)
    .maybeSingle();

  if (selErr) throw selErr;

  let convId;
  let catsFinales = categorias;
  let fueraConv = fuera;

  if (!existente) {
    const { data: inserted, error: insErr } = await supabase
      .from('chatbot_conversaciones')
      .insert({
        session_id,
        canal,
        categorias,
        total_mensajes: 2,
        fuera_horario_laboral: fuera,
        iniciada_en: timestamp,
        ultima_interaccion_en: timestamp,
        resumen: mensaje.slice(0, 160),
      })
      .select('id, categorias, fuera_horario_laboral')
      .single();

    if (insErr) throw insErr;
    convId = inserted.id;
    catsFinales = inserted.categorias;
    fueraConv = inserted.fuera_horario_laboral;
  } else {
    catsFinales = normalizarCategorias([...(existente.categorias || []), ...categorias]);
    const nuevaUltima =
      existente.ultima_interaccion_en && existente.ultima_interaccion_en > timestamp
        ? existente.ultima_interaccion_en
        : timestamp;

    const { error: updErr } = await supabase
      .from('chatbot_conversaciones')
      .update({
        categorias: catsFinales,
        total_mensajes: Number(existente.total_mensajes || 0) + 2,
        ultima_interaccion_en: nuevaUltima,
      })
      .eq('id', existente.id);

    if (updErr) throw updErr;
    convId = existente.id;
    fueraConv = Boolean(existente.fuera_horario_laboral);
  }

  const { error: msgErr } = await supabase.from('chatbot_mensajes').insert([
    {
      conversacion_id: convId,
      rol: 'usuario',
      contenido: mensaje,
      categorias_detectadas: categorias,
      fuera_horario_laboral: fuera,
      origen,
      creado_en: timestamp,
    },
    {
      conversacion_id: convId,
      rol: 'asistente',
      contenido: respuesta,
      categorias_detectadas: [],
      fuera_horario_laboral: fuera,
      origen,
      creado_en: tsBot,
    },
  ]);

  if (msgErr) throw msgErr;

  return {
    conversacion_id: convId,
    categorias: catsFinales,
    fuera_horario_laboral: fuera,
    conversacion_fuera_horario_laboral: fueraConv,
  };
};

/**
 * Despacha en segundo plano la interacción hacia el webhook n8n como respaldo secundario.
 */
const despacharRegistroInteraccionN8n = ({
  session_id,
  mensaje,
  respuesta,
  categorias,
  canal,
  origen,
  timestamp,
}) => {
  const url = resolverUrlRegistroChat();
  if (!url) return;

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.INTERNAL_API_KEY) headers['x-api-key'] = process.env.INTERNAL_API_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  fetch(url, {
    method: 'POST',
    headers,
    signal: controller.signal,
    body: JSON.stringify({
      evento: 'registrar_interaccion_chat',
      session_id,
      mensaje,
      respuesta,
      categorias,
      canal,
      origen,
      timestamp,
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn(`[Chatbot] n8n registro-chat respondió HTTP ${res.status}: ${text}`);
      }
    })
    .catch((err) => {
      console.warn(`[Chatbot] No se pudo registrar la interacción en n8n: ${err.message}`);
    })
    .finally(() => clearTimeout(timer));
};

/**
 * Persiste una interacción (mensaje del usuario + respuesta del asistente) directamente en Supabase
 * usando la RPC atómica `registrar_interaccion_chatbot`. Nunca lanza excepción hacia el cliente.
 * Si Supabase no está disponible, usa respaldo en memoria (modo mock) o webhook n8n.
 */
const registrarInteraccionChatbot = async ({
  session_id,
  mensaje,
  respuesta,
  categorias = [],
  canal = 'web',
  origen = 'gemini_direct',
  timestamp = new Date().toISOString(),
} = {}) => {
  const sessionLimpia = resolverSessionId(session_id);
  const mensajeLimpio = String(mensaje || '').trim().slice(0, 2000);
  const respuestaLimpia = String(respuesta || '').trim().slice(0, 4000);

  if (!mensajeLimpio || !respuestaLimpia) {
    return { ok: false, source: 'invalid_payload' };
  }

  const canalValido = canal === 'whatsapp' ? 'whatsapp' : 'web';
  const origenValido = ['n8n', 'gemini_direct', 'sistema'].includes(origen) ? origen : 'gemini_direct';
  const parsedDate = new Date(timestamp);
  const tsValido = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
  const catsNormalizadas = normalizarCategorias(categorias, mensajeLimpio);

  const payload = {
    session_id: sessionLimpia,
    mensaje: mensajeLimpio,
    respuesta: respuestaLimpia,
    categorias: catsNormalizadas,
    canal: canalValido,
    origen: origenValido,
    timestamp: tsValido,
  };

  if (!supabase) {
    const data = registrarInteraccionEnMemoria(payload);
    return { ok: true, source: 'mock', data };
  }

  try {
    const { data, error } = await supabase.rpc('registrar_interaccion_chatbot', {
      p_session_id: sessionLimpia,
      p_mensaje_usuario: mensajeLimpio,
      p_respuesta_bot: respuestaLimpia,
      p_categorias: catsNormalizadas,
      p_canal: canalValido,
      p_origen: origenValido,
      p_timestamp: tsValido,
    });

    if (!error) {
      return { ok: true, source: 'supabase_rpc', data };
    }

    if (esErrorRpcInexistente(error)) {
      const dataDirect = await registrarInteraccionTablasDirecto(payload);
      return { ok: true, source: 'supabase_direct', data: dataDirect };
    }

    if (esErrorTablaInexistente(error)) {
      console.warn(
        '[Chatbot] La tabla/RPC de historial aún no existe en Supabase. Ejecuta la migración 008.'
      );
      return { ok: false, source: 'supabase_unmigrated', error: error.message };
    }

    throw error;
  } catch (err) {
    console.warn(`[Chatbot] Error persistiendo interacción en Supabase (${err.message}); intentando respaldo n8n.`);
    despacharRegistroInteraccionN8n(payload);
    return { ok: false, source: 'n8n_fallback', error: err.message };
  }
};

/**
 * Alias retrocompatible (fire-and-forget seguro).
 */
const despacharRegistroInteraccion = (params) => {
  registrarInteraccionChatbot(params).catch((err) => {
    console.warn(`[Chatbot] Error inesperado registrando interacción: ${err.message}`);
  });
};

const CATEGORIAS_CATALOGO_META = [
  { id: 'servicios', label: 'Servicios', icon: 'content_cut' },
  { id: 'precios', label: 'Precios', icon: 'payments' },
  { id: 'horarios', label: 'Horarios', icon: 'schedule' },
  { id: 'estilistas', label: 'Estilistas', icon: 'groups' },
  { id: 'reservar_hora', label: 'Reservar hora', icon: 'calendar_add_on' },
  { id: 'cancelar_reprogramar', label: 'Cancelar / Reprogramar', icon: 'event_repeat' },
  { id: 'ubicacion_contacto', label: 'Ubicación y contacto', icon: 'location_on' },
  { id: 'faqs', label: 'FAQs', icon: 'help' },
  { id: 'otros', label: 'Otros', icon: 'chat_bubble' },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esErrorTablaInexistente = (error) => {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
};

const parsearCategoriasFiltro = (raw) => {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(',');
  return [...new Set(arr.map((c) => normalizarTexto(c).trim()).filter((c) => CATEGORIAS_CHATBOT.includes(c)))];
};

const calcularEstadisticasConversaciones = (items = []) => {
  const total = items.length;
  let totalMensajes = 0;
  let fueraHorario = 0;
  const conteoCategorias = {};

  for (const item of items) {
    totalMensajes += Number(item.total_mensajes) || 0;
    if (item.fuera_horario_laboral) fueraHorario += 1;
    const cats = Array.isArray(item.categorias) ? item.categorias : [];
    for (const c of cats) {
      conteoCategorias[c] = (conteoCategorias[c] || 0) + 1;
    }
  }

  let categoriaTop = null;
  let maxCat = 0;
  for (const [cat, count] of Object.entries(conteoCategorias)) {
    if (count > maxCat) {
      maxCat = count;
      categoriaTop = { id: cat, count };
    }
  }

  return {
    total_conversaciones: total,
    total_mensajes: totalMensajes,
    fuera_horario: fueraHorario,
    en_horario: total - fueraHorario,
    pct_fuera_horario: total > 0 ? Number(((fueraHorario / total) * 100).toFixed(1)) : 0,
    conteo_categorias: conteoCategorias,
    categoria_top: categoriaTop,
  };
};

/**
 * Lista conversaciones del chatbot con soporte para filtros multicategoría (AND / OR),
 * franja horaria, rango de fechas y búsqueda de texto en resumen, sesión o mensajes.
 */
const listarConversacionesChatbot = async ({
  categorias,
  modo_categorias = 'AND',
  fuera_horario,
  fecha_desde,
  fecha_hasta,
  busqueda,
  limit = 100,
} = {}) => {
  const catsFiltro = parsearCategoriasFiltro(categorias);
  const modo = String(modo_categorias || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';
  const isIsoDate = (val) => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
  const desde = isIsoDate(fecha_desde) ? fecha_desde.trim() : null;
  const hasta = isIsoDate(fecha_hasta) ? fecha_hasta.trim() : null;
  const searchTerm = typeof busqueda === 'string' ? busqueda.trim() : '';
  const maxRows = Math.min(250, Math.max(1, Number(limit) || 100));

  if (!supabase) {
    let rows = [...conversacionesMockMap.values()].map(({ mensajes: _m, ...cabecera }) => cabecera);

    if (catsFiltro.length > 0) {
      rows = rows.filter((c) => {
        const cats = Array.isArray(c.categorias) ? c.categorias : [];
        return modo === 'OR'
          ? catsFiltro.some((f) => cats.includes(f))
          : catsFiltro.every((f) => cats.includes(f));
      });
    }

    if (fuera_horario === 'true' || fuera_horario === true) {
      rows = rows.filter((c) => Boolean(c.fuera_horario_laboral));
    } else if (fuera_horario === 'false' || fuera_horario === false) {
      rows = rows.filter((c) => !c.fuera_horario_laboral);
    }

    if (desde) {
      const desdeMs = Date.parse(`${desde}T00:00:00-03:00`);
      rows = rows.filter((c) => Date.parse(c.iniciada_en) >= desdeMs);
    }
    if (hasta) {
      const hastaMs = Date.parse(`${hasta}T23:59:59-03:00`);
      rows = rows.filter((c) => Date.parse(c.iniciada_en) <= hastaMs);
    }

    if (searchTerm) {
      const qLower = searchTerm.toLowerCase();
      rows = rows.filter((c) => {
        const full = conversacionesMockMap.get(c.session_id);
        const matchMsg = (full?.mensajes || []).some((m) =>
          String(m.contenido || '').toLowerCase().includes(qLower)
        );
        return (
          matchMsg ||
          String(c.resumen || '').toLowerCase().includes(qLower) ||
          String(c.session_id || '').toLowerCase().includes(qLower)
        );
      });
    }

    rows.sort((a, b) => String(b.ultima_interaccion_en).localeCompare(String(a.ultima_interaccion_en)));
    rows = rows.slice(0, maxRows);

    return {
      items: rows,
      stats: calcularEstadisticasConversaciones(rows),
      source: 'mock',
      warning: 'Supabase no está configurado en el servidor (mostrando historial en memoria local).',
    };
  }

  try {
    // Si hay texto de búsqueda, incluir conversaciones donde coincida cualquier mensaje
    let matchingIdsByMsg = null;
    if (searchTerm) {
      const escaped = searchTerm.replace(/[%_]/g, '\\$&');
      const { data: msgHits, error: msgErr } = await supabase
        .from('chatbot_mensajes')
        .select('conversacion_id')
        .ilike('contenido', `%${escaped}%`)
        .limit(500);

      if (!msgErr && Array.isArray(msgHits)) {
        matchingIdsByMsg = [...new Set(msgHits.map((m) => m.conversacion_id).filter(Boolean))];
      }
    }

    let q = supabase
      .from('chatbot_conversaciones')
      .select(
        'id, session_id, canal, categorias, total_mensajes, fuera_horario_laboral, iniciada_en, ultima_interaccion_en, resumen, metadata'
      );

    if (catsFiltro.length > 0) {
      if (modo === 'OR') {
        q = q.overlaps('categorias', catsFiltro);
      } else {
        q = q.contains('categorias', catsFiltro);
      }
    }

    if (fuera_horario === 'true' || fuera_horario === true) {
      q = q.eq('fuera_horario_laboral', true);
    } else if (fuera_horario === 'false' || fuera_horario === false) {
      q = q.eq('fuera_horario_laboral', false);
    }

    if (desde) {
      q = q.gte('iniciada_en', `${desde}T00:00:00-03:00`);
    }
    if (hasta) {
      q = q.lte('iniciada_en', `${hasta}T23:59:59-03:00`);
    }

    const { data, error } = await q
      .order('ultima_interaccion_en', { ascending: false })
      .limit(maxRows);

    if (error) {
      if (esErrorTablaInexistente(error)) {
        return {
          items: [],
          stats: calcularEstadisticasConversaciones([]),
          source: 'supabase_unmigrated',
          warning: 'La tabla chatbot_conversaciones aún no existe. Ejecuta la migración 008 en Supabase.',
        };
      }
      throw error;
    }

    let rows = Array.isArray(data) ? data : [];

    if (searchTerm) {
      const qLower = searchTerm.toLowerCase();
      const idSet = new Set(matchingIdsByMsg || []);
      rows = rows.filter(
        (c) =>
          idSet.has(c.id) ||
          String(c.resumen || '').toLowerCase().includes(qLower) ||
          String(c.session_id || '').toLowerCase().includes(qLower)
      );
    }

    return {
      items: rows,
      stats: calcularEstadisticasConversaciones(rows),
      source: 'supabase',
    };
  } catch (err) {
    console.error('[Chatbot] Error listando conversaciones:', err.message);
    throw err;
  }
};

/**
 * Obtiene el detalle completo de una conversación (cabecera + todos sus mensajes ordenados).
 */
const obtenerConversacionConMensajes = async (idOrSession) => {
  if (!idOrSession) return null;
  const target = String(idOrSession).trim();

  if (!supabase) {
    for (const conv of conversacionesMockMap.values()) {
      if (conv.id === target || conv.session_id === target) {
        return {
          ...conv,
          mensajes: [...(conv.mensajes || [])],
        };
      }
    }
    return null;
  }

  const isUuid = UUID_REGEX.test(target);
  const { data: conv, error: convErr } = await supabase
    .from('chatbot_conversaciones')
    .select(
      'id, session_id, canal, categorias, total_mensajes, fuera_horario_laboral, iniciada_en, ultima_interaccion_en, resumen, metadata'
    )
    .eq(isUuid ? 'id' : 'session_id', target)
    .maybeSingle();

  if (convErr) {
    if (esErrorTablaInexistente(convErr)) return null;
    throw convErr;
  }
  if (!conv) return null;

  const { data: mensajes, error: msgErr } = await supabase
    .from('chatbot_mensajes')
    .select('id, conversacion_id, rol, contenido, categorias_detectadas, fuera_horario_laboral, origen, creado_en')
    .eq('conversacion_id', conv.id)
    .order('creado_en', { ascending: true })
    .order('id', { ascending: true });

  if (msgErr) throw msgErr;

  return {
    ...conv,
    mensajes: Array.isArray(mensajes) ? mensajes : [],
  };
};

module.exports = {
  CATEGORIAS_CHATBOT,
  CATEGORIAS_CATALOGO_META,
  SESSION_ID_REGEX,
  clasificarPorPalabrasClave,
  normalizarCategorias,
  parsearCategoriasFiltro,
  resolverSessionId,
  resolverUrlRegistroChat,
  registrarInteraccionChatbot,
  despacharRegistroInteraccion,
  listarConversacionesChatbot,
  obtenerConversacionConMensajes,
};

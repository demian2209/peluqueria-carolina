const crypto = require('crypto');
const supabase = require('../database/supabaseClient');

/**
 * Servicio del historial del chatbot.
 *
 * - Catálogo cerrado de categorías (espejo de public.chatbot_categorias_validas() en Supabase).
 * - Clasificador heurístico de respaldo por palabras clave (espejo del nodo "Clasificar Categorías" de n8n).
 * - Despacho asíncrono (fire-and-forget) del evento `registrar_interaccion_chat` hacia n8n (PC07),
 *   que clasifica, valida y persiste la interacción en Supabase mediante la RPC
 *   `registrar_interaccion_chatbot`.
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

/**
 * Despacha en segundo plano la interacción hacia n8n. Nunca lanza ni bloquea la respuesta al cliente.
 */
const despacharRegistroInteraccion = ({
  session_id,
  mensaje,
  respuesta,
  categorias = [],
  canal = 'web',
  origen = 'gemini_direct',
  timestamp = new Date().toISOString(),
}) => {
  const url = resolverUrlRegistroChat();
  if (!url) {
    console.warn('[Chatbot] No se pudo derivar la URL de registro de chat; interacción no persistida.');
    return;
  }

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
      categorias: normalizarCategorias(categorias, mensaje),
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
    return {
      items: [],
      stats: calcularEstadisticasConversaciones([]),
      source: 'mock',
      warning: 'Supabase no está configurado en el servidor.',
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

  if (!supabase) return null;

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
  despacharRegistroInteraccion,
  listarConversacionesChatbot,
  obtenerConversacionConMensajes,
};

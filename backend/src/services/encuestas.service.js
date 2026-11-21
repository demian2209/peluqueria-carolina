const fs = require('fs');
const path = require('path');
const supabase = require('../database/supabaseClient');
const { MOCK_SERVICIOS, MOCK_ESTILISTAS } = require('../database/mockData');
const { obtenerCatalogoCompleto } = require('../controllers/servicios.controller');
const { obtenerEquipoCompleto } = require('../controllers/estilistas.controller');
const { resolverEstilistaMockId } = require('../utils/disponibilidad.utils');
const {
  generarCodigoReserva,
  generarTokenReserva,
} = require('../utils/reservaToken.utils');

const ENCUESTAS_FILE_PATH = path.join(__dirname, '../database/encuestas_satisfaccion.store');

let supabaseTablaDisponible = Boolean(supabase);

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

const esErrorRedSupabase = (error) => {
  if (!error) return false;
  const msg = String(error.message || error.details || '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('network')
  );
};

const formatterHoraChile = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const extraerHoraChile = (isoDate) => {
  const dt = new Date(isoDate);
  if (isNaN(dt.getTime())) return null;
  return formatterHoraChile.format(dt);
};

const extraerFechaChile = (isoDate) => {
  const dt = new Date(isoDate);
  if (isNaN(dt.getTime())) return null;
  const formatterFecha = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatterFecha.formatToParts(dt);
  const yyyy = parts.find((p) => p.type === 'year')?.value;
  const mm = parts.find((p) => p.type === 'month')?.value;
  const dd = parts.find((p) => p.type === 'day')?.value;
  return yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : null;
};

// Semilla inicial de respaldo cuando no hay conexión a Supabase ni archivo .store previo
const SEED_LOCAL_ENCUESTAS = [
  {
    id: 'enc-seed-1',
    reserva_id: 'r1',
    codigo_reserva: 'PC-R1-0900',
    puntaje: 5,
    comentario:
      '¡Increíble atención! Carolina logró exactamente el tono de balayage que buscaba y mi cabello quedó súper suave y brillante.',
    respondida_en: '2026-11-18T19:30:00.000Z',
    cliente_nombre: 'Constanza Morales',
    cliente_email: 'constanza.morales@ejemplo.cl',
    cliente_telefono: '+56984123456',
    servicio_id: 's4-balayage',
    servicio_nombre: 'Balayage & Iluminación Morena',
    estilista_id: 'e1-carolina-valenzuela',
    estilista_nombre: 'Carolina Valenzuela',
    estilista_especialidad: 'Directora Técnica & Colorista Especialista',
    fecha_cita: '2026-11-18',
    hora_inicio: '09:00',
    hora_fin: '12:00',
    estado_reserva: 'atendida',
  },
  {
    id: 'enc-seed-2',
    reserva_id: 'r2',
    codigo_reserva: 'PC-R2-1400',
    puntaje: 5,
    comentario:
      'Excelente experiencia con Matías, muy prolijo en el degradado y el ritual de barba con toallas calientes es de otro nivel.',
    respondida_en: '2026-11-19T16:45:00.000Z',
    cliente_nombre: 'Rodrigo Fuenzalida',
    cliente_email: 'rodrigo.fuenzalida@ejemplo.cl',
    cliente_telefono: '+56976543210',
    servicio_id: 's2-corte-caballero',
    servicio_nombre: 'Corte Caballero & Fade',
    estilista_id: 'e2-matias-munoz',
    estilista_nombre: 'Matías Muñoz',
    estilista_especialidad: 'Barbero Principal',
    fecha_cita: '2026-11-19',
    hora_inicio: '15:00',
    hora_fin: '15:40',
    estado_reserva: 'atendida',
  },
  {
    id: 'enc-seed-3',
    reserva_id: 'r3',
    codigo_reserva: 'PC-R3-1100',
    puntaje: 4,
    comentario:
      'El botox capilar dejó mi pelo sin frizz y con mucho movimiento. Muy puntuales con la hora agendada.',
    respondida_en: '2026-11-20T14:15:00.000Z',
    cliente_nombre: 'Javiera Castro',
    cliente_email: 'javiera.castro@ejemplo.cl',
    cliente_telefono: '+56965432198',
    servicio_id: 's6-botox-capilar',
    servicio_nombre: 'Botox Capilar Antifrizz',
    estilista_id: 'e3-camila-soto',
    estilista_nombre: 'Camila Soto',
    estilista_especialidad: 'Especialista en Tratamientos Capilares & Alisados',
    fecha_cita: '2026-11-20',
    hora_inicio: '11:00',
    hora_fin: '12:30',
    estado_reserva: 'atendida',
  },
];

const normalizarRegistroEncuesta = (row) => {
  if (!row) return null;
  const puntajeNum = Math.min(5, Math.max(1, Number(row.puntaje) || 5));
  return {
    id: String(row.id ?? `enc-${row.reserva_id}`),
    reserva_id: String(row.reserva_id),
    puntaje: puntajeNum,
    comentario: typeof row.comentario === 'string' ? row.comentario.trim() : '',
    respondida_en: row.respondida_en || row.created_at || new Date().toISOString(),
    // Metadatos opcionales pre-guardados en store local
    ...(row.codigo_reserva ? { codigo_reserva: String(row.codigo_reserva) } : {}),
    ...(row.cliente_nombre ? { cliente_nombre: String(row.cliente_nombre) } : {}),
    ...(row.cliente_email ? { cliente_email: String(row.cliente_email) } : {}),
    ...(row.cliente_telefono ? { cliente_telefono: String(row.cliente_telefono) } : {}),
    ...(row.servicio_id ? { servicio_id: String(row.servicio_id) } : {}),
    ...(row.servicio_nombre ? { servicio_nombre: String(row.servicio_nombre) } : {}),
    ...(row.estilista_id ? { estilista_id: String(row.estilista_id) } : {}),
    ...(row.estilista_nombre ? { estilista_nombre: String(row.estilista_nombre) } : {}),
    ...(row.estilista_especialidad
      ? { estilista_especialidad: String(row.estilista_especialidad) }
      : {}),
    ...(row.fecha_cita ? { fecha_cita: String(row.fecha_cita) } : {}),
    ...(row.hora_inicio ? { hora_inicio: String(row.hora_inicio) } : {}),
    ...(row.hora_fin ? { hora_fin: String(row.hora_fin) } : {}),
    ...(row.estado_reserva ? { estado_reserva: String(row.estado_reserva) } : {}),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA LOCAL (.store)
// ─────────────────────────────────────────────────────────────────────────────

const leerEncuestasLocal = () => {
  try {
    if (!fs.existsSync(ENCUESTAS_FILE_PATH)) {
      return SEED_LOCAL_ENCUESTAS.map(normalizarRegistroEncuesta).filter(Boolean);
    }
    const raw = fs.readFileSync(ENCUESTAS_FILE_PATH, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(normalizarRegistroEncuesta).filter(Boolean)
      : [];
  } catch (err) {
    console.warn('[Encuestas] No se pudo leer encuestas_satisfaccion.store:', err.message);
    return [];
  }
};

const guardarEncuestasLocal = (lista) => {
  try {
    const dir = path.dirname(ENCUESTAS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${ENCUESTAS_FILE_PATH}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(lista, null, 2), 'utf8');
    fs.renameSync(tmpPath, ENCUESTAS_FILE_PATH);
  } catch (err) {
    console.warn('[Encuestas] Error guardando encuestas_satisfaccion.store:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ENRIQUECIMIENTO CON RESERVAS, CLIENTES, SERVICIOS Y ESTILISTAS
// ─────────────────────────────────────────────────────────────────────────────

const construirMapasCatalogoYEquipo = async () => {
  let catalogo = MOCK_SERVICIOS;
  let equipo = MOCK_ESTILISTAS;

  try {
    const resCat = await obtenerCatalogoCompleto();
    if (Array.isArray(resCat?.items) && resCat.items.length > 0) {
      catalogo = resCat.items;
    }
  } catch (_) {}

  try {
    const resEq = await obtenerEquipoCompleto();
    if (Array.isArray(resEq?.items) && resEq.items.length > 0) {
      equipo = resEq.items;
    }
  } catch (_) {}

  const svcMap = new Map();
  for (const s of catalogo) {
    svcMap.set(String(s.id), s);
  }
  const svcMockMap = {
    '1': 's1-corte-mujer',
    '2': 's1-corte-mujer',
    '3': 's5-coloracion-completa',
    '4': 's4-balayage',
    '5': 's3-ritual-barba',
    '6': 's2-corte-caballero',
    '7': 's6-botox-capilar',
    '8': 's7-alisado-organico',
    '9': 's8-masaje-reparador',
    '10': 's9-peinado-social',
    '11': 's10-manicura-rusa',
  };
  for (const [numId, slugId] of Object.entries(svcMockMap)) {
    if (!svcMap.has(numId) && svcMap.has(slugId)) {
      svcMap.set(numId, svcMap.get(slugId));
    }
  }

  const estMap = new Map();
  for (const e of equipo) {
    estMap.set(String(e.id), e);
    const canonical = resolverEstilistaMockId(e.id, `${e.nombre || ''} ${e.apellido || ''}`);
    if (canonical && !estMap.has(canonical)) {
      estMap.set(canonical, e);
    }
  }
  const estMockMap = {
    '1': 'e1-carolina-valenzuela',
    '2': 'e2-matias-munoz',
    '3': 'e3-camila-soto',
    '4': 'e4-gonzalo-riquelme',
    '5': 'e5-valentina-morales',
  };
  for (const [numId, slugId] of Object.entries(estMockMap)) {
    if (!estMap.has(numId) && estMap.has(slugId)) {
      estMap.set(numId, estMap.get(slugId));
    }
  }

  return { svcMap, estMap };
};

/**
 * Enriquece una lista de encuestas cruzando sus `reserva_id` en lote con Supabase y/o memoria.
 */
const enriquecerEncuestas = async (encuestasRaw = [], reservasMemoria = [], consultarSupabase = true) => {
  if (!Array.isArray(encuestasRaw) || encuestasRaw.length === 0) return [];

  const { svcMap, estMap } = await construirMapasCatalogoYEquipo();
  const reservasMap = new Map();

  // 1. Indexar reservas en memoria
  if (Array.isArray(reservasMemoria)) {
    for (const r of reservasMemoria) {
      if (r && r.id !== undefined) {
        reservasMap.set(String(r.id), r);
      }
    }
  }

  // 2. Consultar reservas en Supabase en un solo batch para IDs numéricos/UUID
  if (consultarSupabase && supabase && supabaseTablaDisponible) {
    const idsParaBuscar = [
      ...new Set(
        encuestasRaw
          .map((e) => String(e.reserva_id || '').trim())
          .filter((id) => id && (/^\d+$/.test(id) || /^[0-9a-fA-F-]{36}$/.test(id)))
      ),
    ];

    if (idsParaBuscar.length > 0) {
      try {
        const queryIds = idsParaBuscar.map((id) => (/^\d+$/.test(id) ? Number(id) : id));
        const { data: reservasDb, error } = await supabase
          .from('reservas')
          .select(
            '*, clientes(nombre_completo, email, telefono_whatsapp), estilistas(nombre, especialidad), servicios(nombre, precio, duracion_min)'
          )
          .in('id', queryIds);

        if (!error && Array.isArray(reservasDb)) {
          for (const r of reservasDb) {
            reservasMap.set(String(r.id), r);
          }
        }
      } catch (_) {}
    }
  }

  return encuestasRaw.map((enc) => {
    const r = reservasMap.get(String(enc.reserva_id)) || null;

    let fechaCita = enc.fecha_cita || r?.fecha || null;
    let horaInicio = enc.hora_inicio || r?.hora_inicio || null;
    let horaFin = enc.hora_fin || r?.hora_fin || null;

    if (r?.fecha_hora_inicio) {
      fechaCita = fechaCita || extraerFechaChile(r.fecha_hora_inicio);
      horaInicio = horaInicio || extraerHoraChile(r.fecha_hora_inicio);
    }
    if (r?.fecha_hora_fin) {
      horaFin = horaFin || extraerHoraChile(r.fecha_hora_fin);
    }

    const svcId = String(enc.servicio_id || r?.servicio_id || '');
    const svcObj = svcMap.get(svcId) || null;
    const servicioNombre =
      enc.servicio_nombre ||
      r?.servicios?.nombre ||
      r?.servicio_nombre ||
      svcObj?.nombre ||
      'Servicio de Peluquería';

    const rawEstId = String(enc.estilista_id || r?.estilista_id || '');
    const rawEstNombre =
      enc.estilista_nombre ||
      (r?.estilistas
        ? `${r.estilistas.nombre || ''} ${r.estilistas.apellido || ''}`.trim()
        : r?.estilista_nombre || '');
    const estObj = estMap.get(rawEstId) || (rawEstId ? estMap.get(resolverEstilistaMockId(rawEstId, rawEstNombre)) : null);

    const estilistaNombre =
      rawEstNombre ||
      (estObj ? `${estObj.nombre || ''} ${estObj.apellido || ''}`.trim() : 'Equipo Carolina');
    const estilistaCanonId =
      rawEstId || estilistaNombre
        ? resolverEstilistaMockId(rawEstId, estilistaNombre)
        : 'e1-carolina-valenzuela';
    const estilistaEspecialidad =
      enc.estilista_especialidad ||
      r?.estilistas?.especialidad ||
      estObj?.especialidad ||
      '';

    const clienteNombre =
      enc.cliente_nombre ||
      r?.clientes?.nombre_completo ||
      r?.cliente_nombre ||
      'Cliente verificado';
    const clienteEmail =
      enc.cliente_email || r?.clientes?.email || r?.cliente_email || '';
    const clienteTelefono =
      enc.cliente_telefono ||
      r?.clientes?.telefono_whatsapp ||
      r?.cliente_telefono ||
      '';

    const codigoReserva =
      enc.codigo_reserva ||
      r?.codigo_reserva ||
      generarCodigoReserva(
        enc.reserva_id,
        r?.fecha_hora_inicio || null,
        fechaCita,
        horaInicio
      );

    const estadoReserva = enc.estado_reserva || r?.estado || 'atendida';

    return {
      id: String(enc.id),
      reserva_id: String(enc.reserva_id),
      codigo_reserva: codigoReserva,
      puntaje: Number(enc.puntaje),
      comentario: enc.comentario || '',
      respondida_en: enc.respondida_en,
      cliente_nombre: clienteNombre,
      cliente_email: clienteEmail,
      cliente_telefono: clienteTelefono,
      servicio_id: svcObj ? String(svcObj.id) : svcId,
      servicio_nombre: servicioNombre,
      estilista_id: estilistaCanonId,
      estilista_nombre: estilistaNombre,
      estilista_especialidad: estilistaEspecialidad,
      fecha_cita: fechaCita,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      estado_reserva: estadoReserva,
      gestion_token: generarTokenReserva(enc.reserva_id),
    };
  });
};

/**
 * Calcula KPIs estadísticos sobre una colección de encuestas.
 */
const calcularEstadisticasEncuestas = (items = []) => {
  const total = items.length;
  const distribucion = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sumaPuntajes = 0;
  let conComentario = 0;
  let positivas = 0;

  for (const item of items) {
    const p = Math.min(5, Math.max(1, Number(item.puntaje) || 5));
    distribucion[p] = (distribucion[p] || 0) + 1;
    sumaPuntajes += p;
    if (p >= 4) positivas++;
    if (item.comentario && String(item.comentario).trim().length > 0) {
      conComentario++;
    }
  }

  const promedio = total > 0 ? Number((sumaPuntajes / total).toFixed(2)) : 0;
  const satisfaccion_positiva_pct =
    total > 0 ? Math.round((positivas / total) * 100) : 0;

  return {
    total,
    promedio,
    satisfaccion_positiva_pct,
    con_comentario: conComentario,
    positivas,
    distribucion,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONES PÚBLICAS DEL SERVICIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene todas las encuestas enriquecidas y filtradas.
 */
const listarEncuestas = async (
  {
    puntaje,
    estilista_id,
    servicio_id,
    fecha_desde,
    fecha_hasta,
    solo_comentarios,
    busqueda,
  } = {},
  reservasMemoria = []
) => {
  let rawItems = [];
  let source = 'local';

  if (supabase && supabaseTablaDisponible) {
    try {
      const { data, error } = await supabase
        .from('encuestas_satisfaccion')
        .select('*')
        .order('respondida_en', { ascending: false });

      if (error) {
        if (esErrorTablaInexistente(error)) {
          supabaseTablaDisponible = false;
        } else if (!esErrorRedSupabase(error)) {
          throw error;
        }
      } else if (Array.isArray(data)) {
        rawItems = data.map(normalizarRegistroEncuesta).filter(Boolean);
        source = 'supabase';

        // Fusionar registros locales que no estén en Supabase (ej. creados cuando n8n/red estuvo caída)
        if (fs.existsSync(ENCUESTAS_FILE_PATH)) {
          const locales = leerEncuestasLocal();
          const reservasEnSb = new Set(rawItems.map((i) => String(i.reserva_id)));
          for (const loc of locales) {
            if (
              !String(loc.id).startsWith('enc-seed-') &&
              !reservasEnSb.has(String(loc.reserva_id))
            ) {
              rawItems.push(loc);
            }
          }
        }
      }
    } catch (err) {
      if (esErrorTablaInexistente(err)) {
        supabaseTablaDisponible = false;
      } else {
        console.warn('[Encuestas] Usando respaldo local por error en Supabase:', err.message);
      }
    }
  }

  if (source === 'local') {
    rawItems = leerEncuestasLocal();
  }

  let enriquecidas = await enriquecerEncuestas(rawItems, reservasMemoria, source === 'supabase');

  // Ordenar más recientes primero
  enriquecidas.sort((a, b) =>
    String(b.respondida_en || '').localeCompare(String(a.respondida_en || ''))
  );

  // Estadísticas globales (antes de filtros de búsqueda puntual, o sobre el universo cargado)
  const statsGlobales = calcularEstadisticasEncuestas(enriquecidas);

  // Aplicar filtros
  if (puntaje !== undefined && puntaje !== null && puntaje !== '' && puntaje !== 'all') {
    const pNum = Number(puntaje);
    if (Number.isInteger(pNum) && pNum >= 1 && pNum <= 5) {
      enriquecidas = enriquecidas.filter((e) => Number(e.puntaje) === pNum);
    }
  }

  if (estilista_id && estilista_id !== 'all' && estilista_id !== 'todos') {
    const targetEst = resolverEstilistaMockId(estilista_id);
    enriquecidas = enriquecidas.filter(
      (e) =>
        String(e.estilista_id) === String(estilista_id) ||
        String(e.estilista_id) === String(targetEst)
    );
  }

  if (servicio_id && servicio_id !== 'all') {
    enriquecidas = enriquecidas.filter(
      (e) => String(e.servicio_id) === String(servicio_id)
    );
  }

  if (fecha_desde && /^\d{4}-\d{2}-\d{2}$/.test(fecha_desde)) {
    enriquecidas = enriquecidas.filter((e) => {
      const f = e.fecha_cita || String(e.respondida_en || '').slice(0, 10);
      return f >= fecha_desde;
    });
  }

  if (fecha_hasta && /^\d{4}-\d{2}-\d{2}$/.test(fecha_hasta)) {
    enriquecidas = enriquecidas.filter((e) => {
      const f = e.fecha_cita || String(e.respondida_en || '').slice(0, 10);
      return f <= fecha_hasta;
    });
  }

  if (solo_comentarios === true || solo_comentarios === 'true') {
    enriquecidas = enriquecidas.filter(
      (e) => Boolean(e.comentario && String(e.comentario).trim().length > 0)
    );
  }

  if (busqueda && String(busqueda).trim()) {
    const q = String(busqueda).trim().toLowerCase();
    enriquecidas = enriquecidas.filter(
      (e) =>
        String(e.codigo_reserva || '').toLowerCase().includes(q) ||
        String(e.cliente_nombre || '').toLowerCase().includes(q) ||
        String(e.cliente_email || '').toLowerCase().includes(q) ||
        String(e.comentario || '').toLowerCase().includes(q) ||
        String(e.servicio_nombre || '').toLowerCase().includes(q) ||
        String(e.estilista_nombre || '').toLowerCase().includes(q)
    );
  }

  return {
    items: enriquecidas,
    stats: statsGlobales,
    filtered_stats: calcularEstadisticasEncuestas(enriquecidas),
    source,
  };
};

/**
 * Busca una encuesta asociada a un `reserva_id` (en Supabase o en store local).
 */
const obtenerEncuestaPorReservaId = async (reservaId) => {
  if (!reservaId) return null;
  const idStr = String(reservaId).trim();

  if (supabase && supabaseTablaDisponible && /^\d+$/.test(idStr)) {
    try {
      const { data, error } = await supabase
        .from('encuestas_satisfaccion')
        .select('id, reserva_id, puntaje, comentario, respondida_en')
        .eq('reserva_id', Number(idStr))
        .maybeSingle();

      if (!error && data) {
        return normalizarRegistroEncuesta(data);
      }
    } catch (_) {}
  }

  const locales = leerEncuestasLocal();
  return (
    locales.find((e) => String(e.reserva_id) === idStr) || null
  );
};

/**
 * Persiste una nueva respuesta de encuesta en Supabase y/o en el store local.
 * Garantiza unicidad por `reserva_id`.
 */
const guardarEncuesta = async ({
  reserva_id,
  puntaje,
  comentario = '',
  metadataReserva = {},
}) => {
  const idStr = String(reserva_id).trim();
  const puntajeNum = Number(puntaje);
  const comentarioLimpio =
    typeof comentario === 'string' ? comentario.trim().slice(0, 1000) : '';
  const ahoraIso = new Date().toISOString();

  // Verificar si ya existe en Supabase o local
  const existente = await obtenerEncuestaPorReservaId(idStr);
  if (existente) {
    const err = new Error('La encuesta de esta reserva ya fue respondida.');
    err.statusCode = 409;
    throw err;
  }

  let savedRow = null;
  let source = 'local';

  if (supabase && supabaseTablaDisponible && /^\d+$/.test(idStr)) {
    try {
      const { data, error } = await supabase
        .from('encuestas_satisfaccion')
        .insert({
          reserva_id: Number(idStr),
          puntaje: puntajeNum,
          comentario: comentarioLimpio,
          respondida_en: ahoraIso,
        })
        .select('*')
        .single();

      if (!error && data) {
        savedRow = normalizarRegistroEncuesta(data);
        source = 'supabase';
      } else if (error && error.code === '23505') {
        const err = new Error('La encuesta de esta reserva ya fue respondida.');
        err.statusCode = 409;
        throw err;
      }
    } catch (err) {
      if (err.statusCode === 409) throw err;
    }
  }

  const nuevoLocal = normalizarRegistroEncuesta({
    id: savedRow?.id || `enc-${Date.now().toString(36)}`,
    reserva_id: idStr,
    puntaje: puntajeNum,
    comentario: comentarioLimpio,
    respondida_en: savedRow?.respondida_en || ahoraIso,
    ...metadataReserva,
  });

  // Persistir también en store local para disponibilidad inmediata y modo offline
  const listaLocal = leerEncuestasLocal().filter(
    (e) => String(e.reserva_id) !== idStr
  );
  listaLocal.unshift(nuevoLocal);
  guardarEncuestasLocal(listaLocal);

  return { data: savedRow || nuevoLocal, source };
};

/**
 * Elimina una encuesta por su ID o reserva_id (uso administrativo / limpieza QA).
 */
const eliminarEncuesta = async (idOrReservaId) => {
  const target = String(idOrReservaId).trim();
  let deletedFromSupabase = false;

  if (supabase && supabaseTablaDisponible && /^\d+$/.test(target)) {
    try {
      const { data } = await supabase
        .from('encuestas_satisfaccion')
        .delete()
        .or(`id.eq.${Number(target)},reserva_id.eq.${Number(target)}`)
        .select('id');
      if (Array.isArray(data) && data.length > 0) {
        deletedFromSupabase = true;
      }
    } catch (_) {}
  }

  const listaLocal = leerEncuestasLocal();
  const filtrada = listaLocal.filter(
    (e) => String(e.id) !== target && String(e.reserva_id) !== target
  );
  const deletedFromLocal = filtrada.length !== listaLocal.length;

  if (deletedFromLocal) {
    guardarEncuestasLocal(filtrada);
  }

  if (!deletedFromSupabase && !deletedFromLocal) {
    const err = new Error(`Encuesta '${target}' no encontrada.`);
    err.statusCode = 404;
    throw err;
  }

  return { id: target, source: deletedFromSupabase ? 'supabase' : 'local' };
};

module.exports = {
  listarEncuestas,
  obtenerEncuestaPorReservaId,
  guardarEncuesta,
  eliminarEncuesta,
  calcularEstadisticasEncuestas,
};

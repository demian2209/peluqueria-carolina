const supabase = require('../database/supabaseClient');
const { getReservasEnMemoria } = require('../controllers/reservas.controller');

const HORARIO_DEFAULT_NEGOCIO = [
  { dia_semana: 0, abierto: true, hora_apertura: '10:00', hora_cierre: '18:00' },
  { dia_semana: 1, abierto: true, hora_apertura: '09:00', hora_cierre: '19:00' },
  { dia_semana: 2, abierto: true, hora_apertura: '09:00', hora_cierre: '19:00' },
  { dia_semana: 3, abierto: true, hora_apertura: '09:00', hora_cierre: '19:00' },
  { dia_semana: 4, abierto: true, hora_apertura: '09:00', hora_cierre: '19:00' },
  { dia_semana: 5, abierto: true, hora_apertura: '09:00', hora_cierre: '19:00' },
  { dia_semana: 6, abierto: true, hora_apertura: '09:00', hora_cierre: '19:00' },
];

const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

const round1 = (num, den) => {
  if (!den || den <= 0) return 0;
  return Number(((num * 100) / den).toFixed(1));
};

const esErrorFuncionOTablaFaltante = (error) => {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42883' ||
    code === '42P01' ||
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    msg.includes('could not find the function') ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
};

const extraerPartesChile = (isoOrDate) => {
  if (!isoOrDate) return null;
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    fecha: `${parts.year}-${parts.month}-${parts.day}`,
    mes: `${parts.year}-${parts.month}`,
    dow: dowMap[parts.weekday] ?? 0,
    hour,
    minutes: hour * 60 + minute,
  };
};

const getMondayIso = (fechaIso) => {
  const [y, m, d] = fechaIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  const sunday = new Date(dt);
  sunday.setUTCDate(dt.getUTCDate() + 6);
  return {
    inicio: dt.toISOString().slice(0, 10),
    fin: sunday.toISOString().slice(0, 10),
  };
};

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
};

const evaluarFueraHorario = (partes, horarioCfg = HORARIO_DEFAULT_NEGOCIO) => {
  if (!partes) return false;
  const cfg = horarioCfg.find((h) => Number(h.dia_semana) === partes.dow);
  if (!cfg || !cfg.abierto) return true;
  return !(partes.minutes >= toMin(cfg.hora_apertura) && partes.minutes < toMin(cfg.hora_cierre));
};

const emptyBucket = () => ({
  total_programadas: 0,
  total_no_asistio: 0,
  tasa_inasistencia_pct: 0,
  confirmadas: 0,
  atendidas: 0,
  canceladas: 0,
  pendientes: 0,
});

const acumularEstado = (bucket, estado) => {
  bucket.total_programadas += 1;
  if (estado === 'no_asistio') bucket.total_no_asistio += 1;
  else if (estado === 'confirmada') bucket.confirmadas += 1;
  else if (estado === 'atendida' || estado === 'completada') bucket.atendidas += 1;
  else if (estado === 'cancelada') bucket.canceladas += 1;
  else if (estado === 'pendiente') bucket.pendientes += 1;
};

const finalizarBucket = (bucket) => ({
  ...bucket,
  tasa_inasistencia_pct: round1(bucket.total_no_asistio, bucket.total_programadas),
});

/**
 * Calcula los KPIs de reservas (confirmaciones + inasistencias mensual/semanal/diaria)
 * directamente desde un arreglo de filas de reservas (fallback cuando RPC 009 aún no está migrado o en modo mock).
 */
const calcularKpisReservasEnMemoria = (reservas = [], fechaDesde = null, fechaHasta = null) => {
  const hoyChile = extraerPartesChile(new Date().toISOString());
  const mesActual = hoyChile?.mes || '';

  // KPI 1: Confirmaciones globales del sistema
  const porEstadoGlobal = { pendiente: 0, confirmada: 0, atendida: 0, cancelada: 0, no_asistio: 0 };
  let confirmadasMesActual = 0;

  // KPI 2: Inasistencias filtradas por período
  const resumenPeriodo = emptyBucket();
  const mensualMap = new Map();
  const semanalMap = new Map();
  const diariaMap = new Map();

  for (const r of reservas) {
    const estado = r.estado || 'pendiente';
    const partes = r.fecha_hora_inicio
      ? extraerPartesChile(r.fecha_hora_inicio)
      : r.fecha
        ? { fecha: r.fecha, mes: r.fecha.slice(0, 7) }
        : null;

    if (estado === 'confirmada') {
      porEstadoGlobal.confirmada += 1;
      if (partes && partes.mes === mesActual) confirmadasMesActual += 1;
    } else if (estado === 'atendida' || estado === 'completada') {
      porEstadoGlobal.atendida += 1;
    } else if (estado === 'cancelada') {
      porEstadoGlobal.cancelada += 1;
    } else if (estado === 'no_asistio') {
      porEstadoGlobal.no_asistio += 1;
    } else {
      porEstadoGlobal.pendiente += 1;
    }

    if (!partes) continue;
    if (fechaDesde && partes.fecha < fechaDesde) continue;
    if (fechaHasta && partes.fecha > fechaHasta) continue;

    acumularEstado(resumenPeriodo, estado);

    // Mensual
    if (!mensualMap.has(partes.mes)) {
      mensualMap.set(partes.mes, { mes: partes.mes, ...emptyBucket() });
    }
    acumularEstado(mensualMap.get(partes.mes), estado);

    // Semanal (Lun–Dom)
    const { inicio, fin } = getMondayIso(partes.fecha);
    if (!semanalMap.has(inicio)) {
      semanalMap.set(inicio, {
        semana_inicio: inicio,
        semana_fin: fin,
        primer_dia_con_citas: partes.fecha,
        ultimo_dia_con_citas: partes.fecha,
        ...emptyBucket(),
      });
    }
    const wk = semanalMap.get(inicio);
    if (partes.fecha < wk.primer_dia_con_citas) wk.primer_dia_con_citas = partes.fecha;
    if (partes.fecha > wk.ultimo_dia_con_citas) wk.ultimo_dia_con_citas = partes.fecha;
    acumularEstado(wk, estado);

    // Diaria
    if (!diariaMap.has(partes.fecha)) {
      diariaMap.set(partes.fecha, { fecha: partes.fecha, ...emptyBucket() });
    }
    acumularEstado(diariaMap.get(partes.fecha), estado);
  }

  const totalSistema = reservas.length;
  const confirmaciones = {
    total_confirmadas_actual: porEstadoGlobal.confirmada,
    total_confirmadas_mes_actual: confirmadasMesActual,
    total_reservas_sistema: totalSistema,
    tasa_confirmacion_pct: round1(porEstadoGlobal.confirmada, totalSistema),
    por_estado: porEstadoGlobal,
  };

  const inasistencias = {
    resumen_periodo: finalizarBucket(resumenPeriodo),
    mensual: [...mensualMap.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map(finalizarBucket),
    semanal: [...semanalMap.values()]
      .sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio))
      .map(finalizarBucket),
    diaria: [...diariaMap.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(finalizarBucket),
  };

  return { confirmaciones, inasistencias };
};

/**
 * Calcula el KPI de rendimiento del chatbot fuera de horario laboral en memoria (fallback).
 */
const calcularKpisChatbotEnMemoria = (
  conversaciones = [],
  mensajesUsuario = [],
  horarioCfg = HORARIO_DEFAULT_NEGOCIO,
  fechaDesde = null,
  fechaHasta = null
) => {
  let totalConvs = 0;
  let convsFuera = 0;
  const catsFuera = {};

  for (const c of conversaciones) {
    const p = extraerPartesChile(c.iniciada_en);
    if (!p) continue;
    if (fechaDesde && p.fecha < fechaDesde) continue;
    if (fechaHasta && p.fecha > fechaHasta) continue;
    totalConvs += 1;
    const fuera = evaluarFueraHorario(p, horarioCfg);
    if (fuera) {
      convsFuera += 1;
      for (const cat of Array.isArray(c.categorias) ? c.categorias : []) {
        catsFuera[cat] = (catsFuera[cat] || 0) + 1;
      }
    }
  }

  const horas = Array.from({ length: 24 }, (_, hr) => ({
    hora: hr,
    total: 0,
    fuera_horario: 0,
    en_horario: 0,
  }));
  let totalMsgs = 0;
  let msgsFuera = 0;

  for (const m of mensajesUsuario) {
    const p = extraerPartesChile(m.creado_en);
    if (!p) continue;
    if (fechaDesde && p.fecha < fechaDesde) continue;
    if (fechaHasta && p.fecha > fechaHasta) continue;
    totalMsgs += 1;
    const fuera = evaluarFueraHorario(p, horarioCfg);
    horas[p.hour].total += 1;
    if (fuera) {
      msgsFuera += 1;
      horas[p.hour].fuera_horario += 1;
    } else {
      horas[p.hour].en_horario += 1;
    }
  }

  const topCategoriasFuera = Object.entries(catsFuera)
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria));

  return {
    total_conversaciones: totalConvs,
    conversaciones_fuera_horario: convsFuera,
    conversaciones_en_horario: totalConvs - convsFuera,
    pct_conversaciones_fuera_horario: round1(convsFuera, totalConvs),
    total_interacciones: totalMsgs,
    interacciones_fuera_horario: msgsFuera,
    interacciones_en_horario: totalMsgs - msgsFuera,
    pct_interacciones_fuera_horario: round1(msgsFuera, totalMsgs),
    distribucion_por_hora: horas,
    top_categorias_fuera_horario: topCategoriasFuera,
    horario_configurado: horarioCfg,
  };
};

/**
 * Obtiene el paquete completo de KPIs para el Panel de Administración.
 * Prioriza los RPCs de PostgreSQL (migración 009) y cuenta con respaldo automático
 * sobre consultas directas si 009 aún no ha sido ejecutado.
 */
const obtenerResumenKpis = async ({ fecha_desde, fecha_hasta } = {}) => {
  const desde = isIsoDate(fecha_desde) ? fecha_desde.trim() : null;
  const hasta = isIsoDate(fecha_hasta) ? fecha_hasta.trim() : null;

  if (!supabase) {
    const reservasMem = typeof getReservasEnMemoria === 'function' ? getReservasEnMemoria() : [];
    const { confirmaciones, inasistencias } = calcularKpisReservasEnMemoria(reservasMem, desde, hasta);
    const chatbot = calcularKpisChatbotEnMemoria([], [], HORARIO_DEFAULT_NEGOCIO, desde, hasta);
    return {
      source: 'mock',
      periodo: { fecha_desde: desde, fecha_hasta: hasta },
      confirmaciones,
      inasistencias,
      chatbot,
    };
  }

  // 1. Vía principal optimizada: 3 RPCs en paralelo en PostgreSQL
  try {
    const [confRes, inasRes, chatRes] = await Promise.all([
      supabase.rpc('rpc_kpi_confirmaciones'),
      supabase.rpc('rpc_kpi_inasistencias', {
        p_fecha_desde: desde,
        p_fecha_hasta: hasta,
      }),
      supabase.rpc('rpc_kpi_chatbot_fuera_horario', {
        p_fecha_desde: desde,
        p_fecha_hasta: hasta,
      }),
    ]);

    if (!confRes.error && !inasRes.error && !chatRes.error) {
      return {
        source: 'supabase_rpc',
        periodo: { fecha_desde: desde, fecha_hasta: hasta },
        confirmaciones: confRes.data,
        inasistencias: inasRes.data,
        chatbot: chatRes.data,
      };
    }

    const firstErr = confRes.error || inasRes.error || chatRes.error;
    if (!esErrorFuncionOTablaFaltante(firstErr)) {
      throw firstErr;
    }
  } catch (err) {
    if (!esErrorFuncionOTablaFaltante(err)) {
      throw err;
    }
  }

  // 2. Fallback directo sobre tablas Supabase (si aún no se ejecutó migración 009)
  const [resReservas, resConvs, resMsgs, resHorarios] = await Promise.all([
    supabase.from('reservas').select('id, estado, fecha_hora_inicio'),
    supabase.from('chatbot_conversaciones').select('id, categorias, iniciada_en'),
    supabase.from('chatbot_mensajes').select('id, creado_en').eq('rol', 'usuario'),
    supabase
      .from('configuracion_horario_negocio')
      .select('dia_semana, abierto, hora_apertura, hora_cierre')
      .order('dia_semana', { ascending: true }),
  ]);

  const reservasRows = !resReservas.error && Array.isArray(resReservas.data) ? resReservas.data : [];
  const convsRows = !resConvs.error && Array.isArray(resConvs.data) ? resConvs.data : [];
  const msgsRows = !resMsgs.error && Array.isArray(resMsgs.data) ? resMsgs.data : [];
  const horariosRows =
    !resHorarios.error && Array.isArray(resHorarios.data) && resHorarios.data.length > 0
      ? resHorarios.data.map((h) => ({
          ...h,
          hora_apertura: String(h.hora_apertura || '').slice(0, 5),
          hora_cierre: String(h.hora_cierre || '').slice(0, 5),
        }))
      : HORARIO_DEFAULT_NEGOCIO;

  const { confirmaciones, inasistencias } = calcularKpisReservasEnMemoria(reservasRows, desde, hasta);
  const chatbot = calcularKpisChatbotEnMemoria(convsRows, msgsRows, horariosRows, desde, hasta);

  return {
    source: 'supabase_fallback',
    warning: 'Usando cálculo de respaldo. Ejecuta la migración 009_vistas_y_rpcs_kpis.sql en Supabase para habilitar las RPCs optimizadas.',
    periodo: { fecha_desde: desde, fecha_hasta: hasta },
    confirmaciones,
    inasistencias,
    chatbot,
  };
};

module.exports = {
  HORARIO_DEFAULT_NEGOCIO,
  obtenerResumenKpis,
  calcularKpisReservasEnMemoria,
  calcularKpisChatbotEnMemoria,
};

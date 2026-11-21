const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../database/supabaseClient');
const {
  getDayOfWeek,
  timeToMinutes,
  resolverEstilistaMockId,
} = require('../utils/disponibilidad.utils');

const BLOQUEOS_FILE_PATH = path.join(__dirname, '../database/bloqueos_horarios.store');
const LEGACY_BLOQUEOS_JSON_PATH = path.join(__dirname, '../database/bloqueos_horarios.json');

// Flag en memoria para evitar reintentos fallidos si la tabla aún no fue migrada en Supabase
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

/**
 * Normaliza el identificador de estilista:
 * - 'todos', '', null, undefined => 'todos'
 * - Cualquier ID numérico o canónico => ID canónico ("e1-carolina-valenzuela", etc.)
 */
const normalizarEstilistaId = (estilistaId, estilistaNombre = '') => {
  if (!estilistaId || String(estilistaId).trim().toLowerCase() === 'todos') {
    return 'todos';
  }
  return resolverEstilistaMockId(estilistaId, estilistaNombre);
};

const normalizarHora = (horaStr) => {
  if (!horaStr) return null;
  const [h, m] = String(horaStr).trim().split(':');
  if (h === undefined || m === undefined) return null;
  return `${String(Number(h)).padStart(2, '0')}:${String(Number(m)).padStart(2, '0')}`;
};

const normalizarRegistro = (row) => {
  if (!row) return null;
  const diaCompleto = Boolean(row.dia_completo);
  return {
    id: String(row.id),
    estilista_id: normalizarEstilistaId(row.estilista_id),
    tipo: row.tipo === 'recurrente' ? 'recurrente' : 'fecha',
    fecha: row.tipo === 'fecha' && row.fecha ? String(row.fecha).slice(0, 10) : null,
    dia_semana:
      row.tipo === 'recurrente' && row.dia_semana !== null && row.dia_semana !== undefined
        ? Number(row.dia_semana)
        : null,
    dia_completo: diaCompleto,
    hora_inicio: diaCompleto ? null : normalizarHora(row.hora_inicio),
    hora_fin: diaCompleto ? null : normalizarHora(row.hora_fin),
    motivo: row.motivo ? String(row.motivo).trim() : '',
    activo: row.activo !== false,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA LOCAL JSON (respaldo atómico para modo mock o sin migración 006)
// ─────────────────────────────────────────────────────────────────────────────

const leerBloqueosLocal = () => {
  try {
    const sourcePath = fs.existsSync(BLOQUEOS_FILE_PATH)
      ? BLOQUEOS_FILE_PATH
      : fs.existsSync(LEGACY_BLOQUEOS_JSON_PATH)
        ? LEGACY_BLOQUEOS_JSON_PATH
        : null;
    if (!sourcePath) {
      return [];
    }
    const raw = fs.readFileSync(sourcePath, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizarRegistro).filter(Boolean) : [];
  } catch (err) {
    console.warn('[Bloqueos] No se pudo leer bloqueos_horarios.store:', err.message);
    return [];
  }
};

const guardarBloqueosLocal = (lista) => {
  const dir = path.dirname(BLOQUEOS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${BLOQUEOS_FILE_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(lista, null, 2), 'utf8');
  fs.renameSync(tmpPath, BLOQUEOS_FILE_PATH);
};

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONES DEL SERVICIO
// ─────────────────────────────────────────────────────────────────────────────

const listarBloqueos = async ({ estilista_id, tipo, activo } = {}) => {
  let items = [];
  let source = 'local';

  if (supabase && supabaseTablaDisponible) {
    try {
      const { data, error } = await supabase
        .from('bloqueos_horarios')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (esErrorTablaInexistente(error)) {
          supabaseTablaDisponible = false;
          console.warn(
            '[Bloqueos] Tabla bloqueos_horarios no existe aún en Supabase; usando persistencia local JSON.'
          );
        } else {
          throw error;
        }
      } else if (Array.isArray(data)) {
        items = data.map(normalizarRegistro).filter(Boolean);
        source = 'supabase';
      }
    } catch (err) {
      if (esErrorTablaInexistente(err)) {
        supabaseTablaDisponible = false;
      } else {
        console.warn('[Bloqueos] Error consultando Supabase, fallback local:', err.message);
      }
    }
  }

  if (source === 'local') {
    items = leerBloqueosLocal();
  }

  // Filtros en memoria consistentes para ambas fuentes
  if (estilista_id) {
    const estNorm = normalizarEstilistaId(estilista_id);
    if (estNorm === 'todos') {
      items = items.filter((b) => b.estilista_id === 'todos');
    } else {
      items = items.filter((b) => b.estilista_id === estNorm || b.estilista_id === 'todos');
    }
  }

  if (tipo === 'fecha' || tipo === 'recurrente') {
    items = items.filter((b) => b.tipo === tipo);
  }

  if (activo === true || activo === 'true') {
    items = items.filter((b) => b.activo === true);
  } else if (activo === false || activo === 'false') {
    items = items.filter((b) => b.activo === false);
  }

  // Ordenar: activos primero, luego por fecha o día de semana
  items.sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    return String(b.created_at).localeCompare(String(a.created_at));
  });

  return { items, source };
};

/**
 * Devuelve únicamente los bloqueos ACTIVOS que aplican a un estilista y fecha concretos.
 * Incluye bloqueos globales ('todos') y bloqueos del estilista, tanto puntuales como recurrentes.
 */
const obtenerBloqueosAplicables = async ({ estilista_id, estilista_nombre = '', fecha }) => {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return [];
  }

  const diaSemana = getDayOfWeek(fecha);
  const estNorm = normalizarEstilistaId(estilista_id, estilista_nombre);
  const { items } = await listarBloqueos({ activo: true });

  return items.filter((b) => {
    if (!b.activo) return false;
    const aplicaAEstilista = b.estilista_id === 'todos' || b.estilista_id === estNorm;
    if (!aplicaAEstilista) return false;

    if (b.tipo === 'fecha') {
      return b.fecha === fecha;
    }
    if (b.tipo === 'recurrente') {
      return Number(b.dia_semana) === diaSemana;
    }
    return false;
  });
};

const esBloqueoDuplicado = (existente, nuevo) => {
  if (!existente.activo) return false;
  if (existente.estilista_id !== nuevo.estilista_id) return false;
  if (existente.tipo !== nuevo.tipo) return false;
  if (nuevo.tipo === 'fecha' && existente.fecha !== nuevo.fecha) return false;
  if (nuevo.tipo === 'recurrente' && Number(existente.dia_semana) !== Number(nuevo.dia_semana)) {
    return false;
  }

  if (existente.dia_completo && nuevo.dia_completo) return true;
  if (existente.dia_completo || nuevo.dia_completo) return false;

  const exStart = timeToMinutes(existente.hora_inicio);
  const exEnd = timeToMinutes(existente.hora_fin);
  const nwStart = timeToMinutes(nuevo.hora_inicio);
  const nwEnd = timeToMinutes(nuevo.hora_fin);

  return exStart === nwStart && exEnd === nwEnd;
};

const crearBloqueo = async (payload) => {
  const ahora = new Date().toISOString();
  const diaCompleto = Boolean(payload.dia_completo);
  const tipo = payload.tipo === 'recurrente' ? 'recurrente' : 'fecha';

  const nuevoRegistro = normalizarRegistro({
    id: uuidv4(),
    estilista_id: normalizarEstilistaId(payload.estilista_id),
    tipo,
    fecha: tipo === 'fecha' ? payload.fecha : null,
    dia_semana: tipo === 'recurrente' ? Number(payload.dia_semana) : null,
    dia_completo: diaCompleto,
    hora_inicio: diaCompleto ? null : payload.hora_inicio,
    hora_fin: diaCompleto ? null : payload.hora_fin,
    motivo: payload.motivo || '',
    activo: payload.activo !== undefined ? Boolean(payload.activo) : true,
    created_at: ahora,
    updated_at: ahora,
  });

  // Evitar duplicados exactos activos
  const { items: existentes } = await listarBloqueos({ activo: true });
  const duplicado = existentes.find((item) => esBloqueoDuplicado(item, nuevoRegistro));
  if (duplicado) {
    const err = new Error('Ya existe un bloqueo activo idéntico para ese estilista y horario.');
    err.statusCode = 409;
    throw err;
  }

  if (supabase && supabaseTablaDisponible) {
    try {
      const { data, error } = await supabase
        .from('bloqueos_horarios')
        .insert({
          id: nuevoRegistro.id,
          estilista_id: nuevoRegistro.estilista_id,
          tipo: nuevoRegistro.tipo,
          fecha: nuevoRegistro.fecha,
          dia_semana: nuevoRegistro.dia_semana,
          dia_completo: nuevoRegistro.dia_completo,
          hora_inicio: nuevoRegistro.hora_inicio,
          hora_fin: nuevoRegistro.hora_fin,
          motivo: nuevoRegistro.motivo || null,
          activo: nuevoRegistro.activo,
        })
        .select('*')
        .single();

      if (error) {
        if (esErrorTablaInexistente(error)) {
          supabaseTablaDisponible = false;
        } else {
          throw error;
        }
      } else if (data) {
        return { data: normalizarRegistro(data), source: 'supabase' };
      }
    } catch (err) {
      if (esErrorTablaInexistente(err)) {
        supabaseTablaDisponible = false;
      } else {
        throw err;
      }
    }
  }

  const lista = leerBloqueosLocal();
  lista.unshift(nuevoRegistro);
  guardarBloqueosLocal(lista);
  return { data: nuevoRegistro, source: 'local' };
};

const actualizarBloqueo = async (id, patch) => {
  const { items } = await listarBloqueos();
  const actual = items.find((b) => String(b.id) === String(id));
  if (!actual) {
    const err = new Error(`Bloqueo '${id}' no encontrado.`);
    err.statusCode = 404;
    throw err;
  }

  const tipo = patch.tipo !== undefined ? patch.tipo : actual.tipo;
  const diaCompleto =
    patch.dia_completo !== undefined ? Boolean(patch.dia_completo) : actual.dia_completo;

  const actualizado = normalizarRegistro({
    ...actual,
    ...(patch.estilista_id !== undefined
      ? { estilista_id: normalizarEstilistaId(patch.estilista_id) }
      : {}),
    tipo,
    fecha: tipo === 'fecha' ? (patch.fecha !== undefined ? patch.fecha : actual.fecha) : null,
    dia_semana:
      tipo === 'recurrente'
        ? patch.dia_semana !== undefined
          ? Number(patch.dia_semana)
          : actual.dia_semana
        : null,
    dia_completo: diaCompleto,
    hora_inicio: diaCompleto
      ? null
      : patch.hora_inicio !== undefined
        ? patch.hora_inicio
        : actual.hora_inicio,
    hora_fin: diaCompleto
      ? null
      : patch.hora_fin !== undefined
        ? patch.hora_fin
        : actual.hora_fin,
    motivo: patch.motivo !== undefined ? patch.motivo : actual.motivo,
    activo: patch.activo !== undefined ? Boolean(patch.activo) : actual.activo,
    updated_at: new Date().toISOString(),
  });

  // Validar invariantes combinadas tras el merge
  if (actualizado.tipo === 'fecha' && !actualizado.fecha) {
    const err = new Error('La fecha es obligatoria para bloqueos de tipo fecha.');
    err.statusCode = 400;
    throw err;
  }
  if (
    actualizado.tipo === 'recurrente' &&
    (actualizado.dia_semana === null || actualizado.dia_semana < 0 || actualizado.dia_semana > 6)
  ) {
    const err = new Error('El día de la semana (0 a 6) es obligatorio para bloqueos recurrentes.');
    err.statusCode = 400;
    throw err;
  }
  if (!actualizado.dia_completo) {
    if (!actualizado.hora_inicio || !actualizado.hora_fin) {
      const err = new Error('Debe especificar hora_inicio y hora_fin cuando no es día completo.');
      err.statusCode = 400;
      throw err;
    }
    if (timeToMinutes(actualizado.hora_fin) <= timeToMinutes(actualizado.hora_inicio)) {
      const err = new Error('La hora de fin debe ser estrictamente posterior a la hora de inicio.');
      err.statusCode = 400;
      throw err;
    }
  }

  if (supabase && supabaseTablaDisponible) {
    try {
      const { data, error } = await supabase
        .from('bloqueos_horarios')
        .update({
          estilista_id: actualizado.estilista_id,
          tipo: actualizado.tipo,
          fecha: actualizado.fecha,
          dia_semana: actualizado.dia_semana,
          dia_completo: actualizado.dia_completo,
          hora_inicio: actualizado.hora_inicio,
          hora_fin: actualizado.hora_fin,
          motivo: actualizado.motivo || null,
          activo: actualizado.activo,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        if (esErrorTablaInexistente(error)) {
          supabaseTablaDisponible = false;
        } else {
          throw error;
        }
      } else if (data) {
        return { data: normalizarRegistro(data), source: 'supabase' };
      }
    } catch (err) {
      if (esErrorTablaInexistente(err)) {
        supabaseTablaDisponible = false;
      } else {
        throw err;
      }
    }
  }

  const lista = leerBloqueosLocal();
  const idx = lista.findIndex((b) => String(b.id) === String(id));
  if (idx === -1) {
    const err = new Error(`Bloqueo '${id}' no encontrado.`);
    err.statusCode = 404;
    throw err;
  }
  lista[idx] = actualizado;
  guardarBloqueosLocal(lista);
  return { data: actualizado, source: 'local' };
};

const eliminarBloqueo = async (id) => {
  if (supabase && supabaseTablaDisponible) {
    try {
      const { data, error } = await supabase
        .from('bloqueos_horarios')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) {
        if (esErrorTablaInexistente(error)) {
          supabaseTablaDisponible = false;
        } else {
          throw error;
        }
      } else if (data) {
        return { id: String(data.id), source: 'supabase' };
      } else {
        const err = new Error(`Bloqueo '${id}' no encontrado.`);
        err.statusCode = 404;
        throw err;
      }
    } catch (err) {
      if (esErrorTablaInexistente(err)) {
        supabaseTablaDisponible = false;
      } else {
        throw err;
      }
    }
  }

  const lista = leerBloqueosLocal();
  const exists = lista.some((b) => String(b.id) === String(id));
  if (!exists) {
    const err = new Error(`Bloqueo '${id}' no encontrado.`);
    err.statusCode = 404;
    throw err;
  }
  const filtrada = lista.filter((b) => String(b.id) !== String(id));
  guardarBloqueosLocal(filtrada);
  return { id: String(id), source: 'local' };
};

module.exports = {
  normalizarEstilistaId,
  listarBloqueos,
  obtenerBloqueosAplicables,
  crearBloqueo,
  actualizarBloqueo,
  eliminarBloqueo,
};

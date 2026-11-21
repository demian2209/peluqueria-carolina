const { timeToMinutes, obtenerFechaHoraSistema } = require('../utils/disponibilidad.utils');

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const esFechaCalendarioValida = (fechaStr) => {
  if (!FECHA_REGEX.test(fechaStr)) return false;
  const [y, m, d] = fechaStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
};

/**
 * Valida y sanitiza el payload para POST /api/v1/bloqueos
 */
const validarCrearBloqueo = (req, res, next) => {
  const {
    estilista_id = 'todos',
    tipo,
    fecha,
    dia_semana,
    dia_completo = false,
    hora_inicio,
    hora_fin,
    motivo = '',
    activo = true,
  } = req.body || {};

  const errores = [];

  if (tipo !== 'fecha' && tipo !== 'recurrente') {
    errores.push("El campo 'tipo' debe ser 'fecha' o 'recurrente'.");
  }

  if (tipo === 'fecha') {
    if (!fecha || typeof fecha !== 'string' || !esFechaCalendarioValida(fecha)) {
      errores.push("El campo 'fecha' es obligatorio y debe tener formato válido YYYY-MM-DD.");
    } else {
      const { fechaHoy } = obtenerFechaHoraSistema();
      if (fecha < fechaHoy) {
        errores.push('No se puede crear un bloqueo para una fecha pasada.');
      }
    }
  }

  if (tipo === 'recurrente') {
    const diaNum = Number(dia_semana);
    if (
      dia_semana === undefined ||
      dia_semana === null ||
      dia_semana === '' ||
      !Number.isInteger(diaNum) ||
      diaNum < 0 ||
      diaNum > 6
    ) {
      errores.push("El campo 'dia_semana' debe ser un entero entre 0 (Domingo) y 6 (Sábado).");
    }
  }

  const esDiaCompleto = Boolean(dia_completo);

  if (!esDiaCompleto) {
    if (!hora_inicio || !HORA_REGEX.test(String(hora_inicio))) {
      errores.push("El campo 'hora_inicio' es obligatorio y debe tener formato HH:MM.");
    }
    if (!hora_fin || !HORA_REGEX.test(String(hora_fin))) {
      errores.push("El campo 'hora_fin' es obligatorio y debe tener formato HH:MM.");
    }
    if (
      hora_inicio &&
      hora_fin &&
      HORA_REGEX.test(String(hora_inicio)) &&
      HORA_REGEX.test(String(hora_fin))
    ) {
      if (timeToMinutes(hora_fin) <= timeToMinutes(hora_inicio)) {
        errores.push("El campo 'hora_fin' debe ser estrictamente posterior a 'hora_inicio'.");
      }
    }
  }

  if (motivo !== undefined && motivo !== null && String(motivo).length > 180) {
    errores.push("El campo 'motivo' no puede exceder los 180 caracteres.");
  }

  if (errores.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: errores[0],
      errors: errores,
    });
  }

  // Whitelist de campos permitidos (prevención de mass assignment)
  req.body = {
    estilista_id: String(estilista_id || 'todos').trim(),
    tipo,
    fecha: tipo === 'fecha' ? fecha : null,
    dia_semana: tipo === 'recurrente' ? Number(dia_semana) : null,
    dia_completo: esDiaCompleto,
    hora_inicio: esDiaCompleto ? null : String(hora_inicio),
    hora_fin: esDiaCompleto ? null : String(hora_fin),
    motivo: motivo ? String(motivo).trim() : '',
    activo: Boolean(activo),
  };

  next();
};

/**
 * Valida y sanitiza el payload parcial para PATCH /api/v1/bloqueos/:id
 */
const validarActualizarBloqueo = (req, res, next) => {
  const body = req.body || {};
  const allowedKeys = [
    'estilista_id',
    'tipo',
    'fecha',
    'dia_semana',
    'dia_completo',
    'hora_inicio',
    'hora_fin',
    'motivo',
    'activo',
  ];

  const clean = {};
  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      clean[key] = body[key];
    }
  }

  if (Object.keys(clean).length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Debe enviar al menos un campo válido para actualizar.',
    });
  }

  const errores = [];

  if (clean.tipo !== undefined && clean.tipo !== 'fecha' && clean.tipo !== 'recurrente') {
    errores.push("El campo 'tipo' debe ser 'fecha' o 'recurrente'.");
  }

  if (clean.fecha !== undefined && clean.fecha !== null) {
    if (typeof clean.fecha !== 'string' || !esFechaCalendarioValida(clean.fecha)) {
      errores.push("El campo 'fecha' debe tener formato válido YYYY-MM-DD.");
    }
  }

  if (clean.dia_semana !== undefined && clean.dia_semana !== null) {
    const diaNum = Number(clean.dia_semana);
    if (!Number.isInteger(diaNum) || diaNum < 0 || diaNum > 6) {
      errores.push("El campo 'dia_semana' debe ser un entero entre 0 y 6.");
    } else {
      clean.dia_semana = diaNum;
    }
  }

  if (clean.hora_inicio !== undefined && clean.hora_inicio !== null) {
    if (!HORA_REGEX.test(String(clean.hora_inicio))) {
      errores.push("El campo 'hora_inicio' debe tener formato HH:MM.");
    }
  }

  if (clean.hora_fin !== undefined && clean.hora_fin !== null) {
    if (!HORA_REGEX.test(String(clean.hora_fin))) {
      errores.push("El campo 'hora_fin' debe tener formato HH:MM.");
    }
  }

  if (clean.motivo !== undefined && clean.motivo !== null) {
    if (String(clean.motivo).length > 180) {
      errores.push("El campo 'motivo' no puede exceder los 180 caracteres.");
    } else {
      clean.motivo = String(clean.motivo).trim();
    }
  }

  if (errores.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: errores[0],
      errors: errores,
    });
  }

  req.body = clean;
  next();
};

module.exports = {
  validarCrearBloqueo,
  validarActualizarBloqueo,
};

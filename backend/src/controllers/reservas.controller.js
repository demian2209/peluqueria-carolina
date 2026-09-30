const { v4: uuidv4 } = require('uuid');
const supabase = require('../database/supabaseClient');
const {
  MOCK_SERVICIOS,
  MOCK_ESTILISTAS,
  MOCK_DISPONIBILIDAD,
  MOCK_RESERVAS,
} = require('../database/mockData');
const { timeToMinutes, getDayOfWeek, filterConflicts } = require('../utils/disponibilidad.utils');

// En modo mock, mutamos este array en memoria durante la sesión del servidor
let reservasEnMemoria = [...MOCK_RESERVAS];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dado un estilista_id, servicio_id, fecha y hora_inicio,
 * calcula hora_fin y verifica que el slot sea válido y libre.
 * Retorna { ok, hora_fin, errorMsg } para Supabase y mock por igual.
 */
const validarSlot = async ({ estilista_id, servicio_id, fecha, hora_inicio, excludeId = null }) => {
  // 1. Resolver duración del servicio
  let duracion = 0;
  let estilistaOk = false;

  if (supabase) {
    const [svcRes, estRes] = await Promise.all([
      supabase.from('servicios').select('duracion_min').eq('id', servicio_id).single(),
      supabase.from('estilistas').select('id').eq('id', estilista_id).eq('activo', true).single(),
    ]);
    if (!svcRes.error && svcRes.data) duracion = svcRes.data.duracion_min;
    if (!estRes.error && estRes.data) estilistaOk = true;
  }

  if (!duracion || !estilistaOk) {
    // Fallback mock
    const svc = MOCK_SERVICIOS.find((s) => s.id === servicio_id);
    const est = MOCK_ESTILISTAS.find((e) => e.id === estilista_id && e.activo);
    if (!svc) return { ok: false, errorMsg: `Servicio '${servicio_id}' no encontrado.` };
    if (!est) return { ok: false, errorMsg: `Estilista '${estilista_id}' no encontrado o inactivo.` };
    duracion = svc.duracion_min;
    estilistaOk = true;
  }

  const startMin = timeToMinutes(hora_inicio);
  const endMin = startMin + duracion;
  const pad = (n) => String(n).padStart(2, '0');
  const hora_fin = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;

  // 2. Verificar que el slot cabe dentro del horario laboral del día
  const diaSemana = getDayOfWeek(fecha);
  let horarios = [];

  if (supabase) {
    const { data } = await supabase
      .from('disponibilidad')
      .select('hora_inicio, hora_fin')
      .eq('estilista_id', estilista_id)
      .eq('dia_semana', diaSemana);
    if (data) horarios = data;
  }

  if (horarios.length === 0) {
    horarios = MOCK_DISPONIBILIDAD.filter(
      (h) => h.estilista_id === estilista_id && h.dia_semana === diaSemana
    );
  }

  if (horarios.length === 0) {
    return { ok: false, errorMsg: `El estilista no trabaja ese día.` };
  }

  const dentroDeHorario = horarios.some(
    (h) => startMin >= timeToMinutes(h.hora_inicio) && endMin <= timeToMinutes(h.hora_fin)
  );

  if (!dentroDeHorario) {
    return { ok: false, errorMsg: `El horario ${hora_inicio}–${hora_fin} queda fuera de la jornada laboral del estilista.` };
  }

  // 3. Verificar conflictos con otras reservas del día
  let reservasDelDia = [];

  if (supabase) {
    let q = supabase
      .from('reservas')
      .select('hora_inicio, hora_fin')
      .eq('estilista_id', estilista_id)
      .eq('fecha', fecha)
      .in('estado', ['pendiente', 'confirmada']);

    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    if (data) reservasDelDia = data;
  } else {
    reservasDelDia = reservasEnMemoria.filter(
      (r) =>
        r.estilista_id === estilista_id &&
        r.fecha === fecha &&
        ['pendiente', 'confirmada'].includes(r.estado) &&
        r.id !== excludeId
    );
  }

  const libre = filterConflicts(
    [{ start: startMin, end: endMin }],
    reservasDelDia
  );

  if (libre.length === 0) {
    return { ok: false, errorMsg: `El horario ${hora_inicio}–${hora_fin} no está disponible.` };
  }

  return { ok: true, hora_fin, duracion };
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLADORES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crear una nueva reserva
 * POST /api/v1/reservas
 */
const crearReserva = async (req, res, next) => {
  try {
    const { cliente_nombre, cliente_email, cliente_telefono, estilista_id, servicio_id, fecha, hora_inicio, notas } = req.body;

    // No permitir fechas pasadas
    const hoy = new Date().toISOString().split('T')[0];
    if (fecha < hoy) {
      return res.status(400).json({ status: 'error', message: 'No se puede reservar en una fecha pasada.' });
    }

    // Validar slot
    const validacion = await validarSlot({ estilista_id, servicio_id, fecha, hora_inicio });
    if (!validacion.ok) {
      return res.status(409).json({ status: 'error', message: validacion.errorMsg });
    }

    const { hora_fin } = validacion;

    if (supabase) {
      // Upsert cliente por email
      const { data: clienteData } = await supabase
        .from('clientes')
        .upsert({ nombre: cliente_nombre.trim(), apellido: '', email: cliente_email, telefono: cliente_telefono || null }, { onConflict: 'email' })
        .select('id')
        .single();

      if (clienteData) {
        const precioServicio = await supabase.from('servicios').select('precio').eq('id', servicio_id).single();
        const precio_final = precioServicio.data?.precio ?? null;

        const { data: reserva, error } = await supabase
          .from('reservas')
          .insert({
            cliente_id: clienteData.id,
            estilista_id,
            servicio_id,
            fecha,
            hora_inicio,
            hora_fin,
            precio_final,
            notas: notas || null,
            estado: 'pendiente',
          })
          .select()
          .single();

        if (!error && reserva) {
          return res.status(201).json({ status: 'success', data: reserva });
        }
      }
    }

    // Fallback mock — guardar en memoria
    const svc = MOCK_SERVICIOS.find((s) => s.id === servicio_id);
    const est = MOCK_ESTILISTAS.find((e) => e.id === estilista_id);

    const nuevaReserva = {
      id: uuidv4(),
      cliente_nombre: cliente_nombre.trim(),
      cliente_email,
      cliente_telefono: cliente_telefono || null,
      estilista_id,
      estilista_nombre: est ? `${est.nombre} ${est.apellido}` : estilista_id,
      servicio_id,
      servicio_nombre: svc?.nombre ?? servicio_id,
      fecha,
      hora_inicio,
      hora_fin,
      estado: 'pendiente',
      precio_final: svc?.precio ?? null,
      notas: notas || null,
      created_at: new Date().toISOString(),
    };

    reservasEnMemoria.push(nuevaReserva);

    return res.status(201).json({
      status: 'success',
      source: 'mock',
      data: nuevaReserva,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Listar reservas
 * GET /api/v1/reservas
 * Query: estilista_id, fecha, estado
 */
const getReservas = async (req, res, next) => {
  try {
    const { estilista_id, fecha, estado } = req.query;

    if (supabase) {
      let q = supabase.from('reservas').select('*, estilistas(nombre, apellido), servicios(nombre, precio)');
      if (estilista_id) q = q.eq('estilista_id', estilista_id);
      if (fecha) q = q.eq('fecha', fecha);
      if (estado) q = q.eq('estado', estado);

      const { data, error } = await q.order('fecha').order('hora_inicio');
      if (!error && data) {
        return res.status(200).json({ status: 'success', count: data.length, data });
      }
    }

    // Fallback mock
    let reservas = [...reservasEnMemoria];
    if (estilista_id) reservas = reservas.filter((r) => r.estilista_id === estilista_id);
    if (fecha) reservas = reservas.filter((r) => r.fecha === fecha);
    if (estado) reservas = reservas.filter((r) => r.estado === estado);

    return res.status(200).json({
      status: 'success',
      source: 'mock',
      count: reservas.length,
      data: reservas,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener una reserva por ID
 * GET /api/v1/reservas/:id
 */
const getReservaById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (supabase) {
      const { data, error } = await supabase
        .from('reservas')
        .select('*, estilistas(nombre, apellido), servicios(nombre, precio)')
        .eq('id', id)
        .single();
      if (!error && data) {
        return res.status(200).json({ status: 'success', data });
      }
    }

    const reserva = reservasEnMemoria.find((r) => r.id === id);
    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    return res.status(200).json({ status: 'success', source: 'mock', data: reserva });
  } catch (err) {
    next(err);
  }
};

/**
 * Cancelar una reserva
 * PATCH /api/v1/reservas/:id/cancelar
 * Regla: solo se puede cancelar hasta 12 horas antes del turno.
 */
const cancelarReserva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const CANCELATION_HOURS = 12;

    // Obtener reserva
    let reserva = null;

    if (supabase) {
      const { data } = await supabase.from('reservas').select('*').eq('id', id).single();
      reserva = data;
    }

    if (!reserva) {
      reserva = reservasEnMemoria.find((r) => r.id === id);
    }

    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    if (!['pendiente', 'confirmada'].includes(reserva.estado)) {
      return res.status(409).json({
        status: 'error',
        message: `Solo se pueden cancelar reservas en estado 'pendiente' o 'confirmada'. Estado actual: '${reserva.estado}'.`,
      });
    }

    // Verificar ventana de 12 horas
    const fechaHoraTurno = new Date(`${reserva.fecha}T${reserva.hora_inicio}:00`);
    const ahora = new Date();
    const diffMs = fechaHoraTurno - ahora;
    const diffHoras = diffMs / (1000 * 60 * 60);

    if (diffHoras < CANCELATION_HOURS) {
      return res.status(409).json({
        status: 'error',
        message: `Las cancelaciones deben realizarse al menos ${CANCELATION_HOURS} horas antes del turno.`,
      });
    }

    // Actualizar estado
    if (supabase) {
      const { data: updated, error } = await supabase
        .from('reservas')
        .update({ estado: 'cancelada' })
        .eq('id', id)
        .select()
        .single();
      if (!error && updated) {
        return res.status(200).json({ status: 'success', data: updated });
      }
    }

    // Fallback mock
    reservasEnMemoria = reservasEnMemoria.map((r) =>
      r.id === id ? { ...r, estado: 'cancelada' } : r
    );
    const cancelada = reservasEnMemoria.find((r) => r.id === id);

    return res.status(200).json({ status: 'success', source: 'mock', data: cancelada });
  } catch (err) {
    next(err);
  }
};

/**
 * Confirmar una reserva (uso admin)
 * PATCH /api/v1/reservas/:id/confirmar
 */
const confirmarReserva = async (req, res, next) => {
  try {
    const { id } = req.params;

    let reserva = null;
    if (supabase) {
      const { data } = await supabase.from('reservas').select('*').eq('id', id).single();
      reserva = data;
    }
    if (!reserva) reserva = reservasEnMemoria.find((r) => r.id === id);

    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    if (reserva.estado !== 'pendiente') {
      return res.status(409).json({
        status: 'error',
        message: `Solo se pueden confirmar reservas en estado 'pendiente'. Estado actual: '${reserva.estado}'.`,
      });
    }

    if (supabase) {
      const { data: updated, error } = await supabase
        .from('reservas')
        .update({ estado: 'confirmada' })
        .eq('id', id)
        .select()
        .single();
      if (!error && updated) {
        return res.status(200).json({ status: 'success', data: updated });
      }
    }

    reservasEnMemoria = reservasEnMemoria.map((r) =>
      r.id === id ? { ...r, estado: 'confirmada' } : r
    );
    const confirmada = reservasEnMemoria.find((r) => r.id === id);

    return res.status(200).json({ status: 'success', source: 'mock', data: confirmada });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crearReserva,
  getReservas,
  getReservaById,
  cancelarReserva,
  confirmarReserva,
};

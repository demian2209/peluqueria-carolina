const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../database/supabaseClient');
const {
  MOCK_SERVICIOS,
  MOCK_ESTILISTAS,
  MOCK_DISPONIBILIDAD,
  MOCK_RESERVAS,
} = require('../database/mockData');
const { timeToMinutes, getDayOfWeek, filterConflicts, obtenerFechaHoraSistema, resolverEstilistaMockId, evaluarBloqueoParaSlot } = require('../utils/disponibilidad.utils');
const { obtenerCatalogoCompleto } = require('./servicios.controller');
const { obtenerEquipoCompleto } = require('./estilistas.controller');
const { obtenerBloqueosAplicables } = require('../services/bloqueos.service');
const {
  obtenerEncuestaPorReservaId,
  guardarEncuesta,
} = require('../services/encuestas.service');
const { normalizarTelefonoChileno } = require('../utils/telefono.utils');
const {
  generarCodigoReserva,
  parsearIdentificadorReserva,
  generarTokenReserva,
  verificarTokenReserva,
  verificarTokenAdmin,
} = require('../utils/reservaToken.utils');

/**
 * Construye los headers para despachar webhooks internos a n8n,
 * incluyendo x-api-key si INTERNAL_API_KEY está configurado.
 */
const buildN8nHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.INTERNAL_API_KEY) {
    headers['x-api-key'] = process.env.INTERNAL_API_KEY;
  }
  return headers;
};

/**
 * Comparación segura en tiempo constante entre dos strings.
 */
const safeCompareStrings = (a, b) => {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

// En modo mock, mutamos este array en memoria durante la sesión del servidor
let reservasEnMemoria = [...MOCK_RESERVAS];

const getReservasEnMemoria = () => reservasEnMemoria;

const formatterHoraChile = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const extraerHoraChile = (isoDate) => {
  const dt = new Date(isoDate);
  if (isNaN(dt.getTime())) return '00:00';
  return formatterHoraChile.format(dt);
};

/**
 * Resuelve el código único de reserva (PC-<ID>-<HASH>).
 * Si la fila ya tiene `codigo_reserva` explícito lo usa; de lo contrario lo deriva
 * determinísticamente a partir del ID y el horario de inicio.
 */
const resolverCodigoReserva = (r) => {
  if (!r) return '';
  if (r.codigo_reserva) return String(r.codigo_reserva).toUpperCase();
  return generarCodigoReserva(r.id, r.fecha_hora_inicio, r.fecha, r.hora_inicio);
};

/**
 * Intenta persistir `codigo_reserva` en la tabla `reservas` de Supabase.
 * Si la migración 003 aún no fue ejecutada manualmente en el motor remoto,
 * ignora el error de columna sin interrumpir el flujo transaccional.
 */
const persistirCodigoEnSupabase = async (reservaId, codigoReserva) => {
  if (!supabase || !reservaId || !codigoReserva) return;
  try {
    await supabase
      .from('reservas')
      .update({ codigo_reserva: codigoReserva })
      .eq('id', reservaId);
  } catch (_) {}
};

/**
 * Busca una reserva por ID o por Código de Reserva (`PC-XX-XXXX`) tanto en Supabase como en memoria.
 */
const getReservaRawById = async (idOrCode) => {
  if (!idOrCode) return null;
  const parsed = parsearIdentificadorReserva(idOrCode);

  if (supabase) {
    // 1. Si viene un código PC-<ID>-<HASH> y la parte ID es numérica, buscar por ID primario
    const candidateId = parsed.isCode ? parsed.extractedId : parsed.raw;
    if (/^\d+$/.test(candidateId)) {
      const { data, error } = await supabase
        .from('reservas')
        .select('*, clientes(nombre_completo, email, telefono_whatsapp), estilistas(nombre, especialidad), servicios(nombre, precio, duracion_min)')
        .eq('id', Number(candidateId))
        .maybeSingle();
      if (!error && data) return data;
    }

    // 2. Búsqueda directa por columna codigo_reserva (si existe en BD)
    if (parsed.isCode) {
      try {
        const { data: byCol, error: errCol } = await supabase
          .from('reservas')
          .select('*, clientes(nombre_completo, email, telefono_whatsapp), estilistas(nombre, especialidad), servicios(nombre, precio, duracion_min)')
          .ilike('codigo_reserva', parsed.raw)
          .maybeSingle();
        if (!errCol && byCol) return byCol;
      } catch (_) {}
    }

    // 3. Búsqueda directa por id UUID
    if (!parsed.isCode) {
      const { data, error } = await supabase
        .from('reservas')
        .select('*, clientes(nombre_completo, email, telefono_whatsapp), estilistas(nombre, especialidad), servicios(nombre, precio, duracion_min)')
        .eq('id', parsed.raw)
        .maybeSingle();
      if (!error && data) return data;
    }
  }

  // Fallback en memoria (por id, por codigo_reserva guardado, o por codigo_reserva calculado)
  return (
    reservasEnMemoria.find((r) => {
      if (String(r.id) === String(parsed.raw)) return true;
      const code = resolverCodigoReserva(r).toUpperCase();
      if (code === parsed.raw.toUpperCase()) return true;
      if (parsed.isCode) {
        const idClean = String(r.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
        if (idClean === parsed.extractedId) return true;
      }
      return false;
    }) || null
  );
};

/**
 * Despacho asíncrono y resiliente hacia n8n Router o Webhook específico.
 * No bloquea la respuesta HTTP al cliente.
 */
const despacharEventoN8N = (evento, payload) => {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/pc06-webhook-router';
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

  // Extraer fecha y horas tanto si vienen normalizadas como si vienen en formato timestamptz (Supabase)
  let fecha = payload.fecha || null;
  let hora_inicio = payload.hora_inicio || null;
  let hora_fin = payload.hora_fin || null;

  if (payload.fecha_hora_inicio) {
    const dIni = new Date(payload.fecha_hora_inicio);
    if (!isNaN(dIni.getTime())) {
      fecha = fecha || dIni.toISOString().split('T')[0];
      hora_inicio = hora_inicio || extraerHoraChile(payload.fecha_hora_inicio);
    }
  }

  if (payload.fecha_hora_fin) {
    const dFin = new Date(payload.fecha_hora_fin);
    if (!isNaN(dFin.getTime())) {
      hora_fin = hora_fin || extraerHoraChile(payload.fecha_hora_fin);
    }
  }

  const reservaIdStr = String(payload.id || payload.reserva_id);
  const codigoReserva =
    payload.codigo_reserva ||
    generarCodigoReserva(reservaIdStr, payload.fecha_hora_inicio, fecha, hora_inicio);
  const gestionToken = payload.gestion_token || generarTokenReserva(reservaIdStr);

  const urlReprogramar = `${frontendUrl}/?reserva=${encodeURIComponent(codigoReserva)}&token=${encodeURIComponent(gestionToken)}&accion=reprogramar#reservar`;
  const urlCancelar = `${frontendUrl}/?reserva=${encodeURIComponent(codigoReserva)}&token=${encodeURIComponent(gestionToken)}&accion=cancelar#reservar`;
  const enlaceEncuesta = `${frontendUrl}/encuesta?reserva_id=${encodeURIComponent(reservaIdStr)}&token=${encodeURIComponent(gestionToken)}`;

  const bodyData = {
    evento,
    reserva_id: reservaIdStr,
    codigo_reserva: codigoReserva,
    codigo_reserva_anterior: payload.codigo_reserva_anterior || null,
    gestion_token: gestionToken,
    enlace_encuesta: enlaceEncuesta,
    botones: {
      url_reprogramar: urlReprogramar,
      url_cancelar: urlCancelar,
      url_encuesta: enlaceEncuesta,
      wa_payload_cancelar: `btn_cancelar:${reservaIdStr}:${codigoReserva}`,
      wa_payload_reprogramar: `btn_reprogramar:${reservaIdStr}:${codigoReserva}`,
    },
    cliente: {
      nombre: payload.cliente_nombre || payload.cliente?.nombre || payload.clientes?.nombre_completo || null,
      email: payload.cliente_email || payload.cliente?.email || payload.clientes?.email || null,
      telefono: normalizarTelefonoChileno(payload.cliente_telefono || payload.cliente?.telefono || payload.clientes?.telefono_whatsapp) || null,
    },
    servicio_id: payload.servicio_id || null,
    servicio: payload.servicio_nombre || payload.servicio || payload.servicios?.nombre || null,
    estilista_id: payload.estilista_id || null,
    estilista: payload.estilista_nombre || (payload.estilistas ? `${payload.estilistas.nombre} ${payload.estilistas.apellido || ''}`.trim() : null),
    fecha,
    hora_inicio,
    hora_fin,
    estado: payload.estado || null,
  };

  fetch(n8nWebhookUrl, {
    method: 'POST',
    headers: buildN8nHeaders(),
    body: JSON.stringify(bodyData),
  })
    .then(async (n8nRes) => {
      if (n8nRes.ok) {
        console.log(`[n8n] ✅ Evento '${evento}' para reserva #${bodyData.reserva_id} despachado (HTTP ${n8nRes.status})`);
      } else {
        const text = await n8nRes.text();
        console.warn(`[n8n] ⚠️ Evento '${evento}' para reserva #${bodyData.reserva_id} respondió HTTP ${n8nRes.status}: ${text}`);
      }
    })
    .catch((n8nErr) => {
      console.error(`[n8n] ⚠️ No se pudo enviar webhook '${evento}' a n8n: ${n8nErr.message}`);
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dado un estilista_id, servicio_id, fecha y hora_inicio,
 * calcula hora_fin y verifica que el slot sea válido y libre.
 * Retorna { ok, hora_fin, errorMsg } para Supabase y mock por igual.
 */
const validarSlot = async ({ estilista_id, servicio_id, fecha, hora_inicio, excludeId = null }) => {
  const estIdStr = String(estilista_id);
  const svcIdStr = String(servicio_id);
  const estNum = isNaN(estilista_id) ? null : Number(estilista_id);
  const svcNum = isNaN(servicio_id) ? null : Number(servicio_id);

  const estMockMap = {
    '1': 'e1-carolina-valenzuela',
    '2': 'e2-matias-munoz',
    '3': 'e3-camila-soto',
    '4': 'e4-gonzalo-riquelme',
    '5': 'e5-valentina-morales',
  };
  const estMockId = estMockMap[estIdStr] || estIdStr;

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
  const svcMockId = svcMockMap[svcIdStr] || svcIdStr;

  // 1. Resolver duración del servicio sincronizada con "Nuestra Selección" y validar estilista
  let duracion = 0;
  let estilistaOk = false;
  let estilistaNombreDb = '';

  try {
    const { items: catalogo } = await obtenerCatalogoCompleto();
    const svcCatalogo = catalogo.find(
      (s) => String(s.id) === svcIdStr || String(s.id) === svcMockId
    );
    if (svcCatalogo && Number(svcCatalogo.duracion_min) > 0) {
      duracion = Number(svcCatalogo.duracion_min);
    }
  } catch (_) {}

  try {
    const { items: equipo } = await obtenerEquipoCompleto();
    const estEquipo = equipo.find(
      (e) =>
        (String(e.id) === estIdStr || String(e.id) === estMockId) &&
        e.activo === true
    );
    if (estEquipo) {
      estilistaOk = true;
      estilistaNombreDb = `${estEquipo.nombre || ''} ${estEquipo.apellido || ''}`.trim();
    }
  } catch (_) {}

  if (supabase && (!duracion || !estilistaOk)) {
    const [svcRes, estRes] = await Promise.all([
      !duracion
        ? supabase.from('servicios').select('duracion_min').eq('id', svcNum !== null ? svcNum : servicio_id).single()
        : Promise.resolve({ data: { duracion_min: duracion }, error: null }),
      !estilistaOk
        ? supabase.from('estilistas').select('id, nombre, apellido').eq('id', estNum !== null ? estNum : estilista_id).eq('activo', true).single()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (!duracion && !svcRes.error && svcRes.data) duracion = svcRes.data.duracion_min;
    if (!estilistaOk && !estRes.error && estRes.data) {
      estilistaOk = true;
      estilistaNombreDb = `${estRes.data.nombre || ''} ${estRes.data.apellido || ''}`.trim();
    }
  }

  const estMockIdResolved = resolverEstilistaMockId(estIdStr, estilistaNombreDb);

  if (!duracion || !estilistaOk) {
    // Fallback mock
    const svc = MOCK_SERVICIOS.find((s) => s.id === servicio_id || s.id === svcMockId);
    const est = MOCK_ESTILISTAS.find((e) => (e.id === estilista_id || e.id === estMockId || e.id === estMockIdResolved) && e.activo);
    if (!duracion && !svc) return { ok: false, errorMsg: `Servicio '${servicio_id}' no encontrado.` };
    if (!estilistaOk && !est) return { ok: false, errorMsg: `Estilista '${estilista_id}' no encontrado o inactivo.` };
    if (!duracion && svc) duracion = svc.duracion_min;
    estilistaOk = true;
  }

  const startMin = timeToMinutes(hora_inicio);
  const endMin = startMin + duracion;
  const pad = (n) => String(n).padStart(2, '0');
  const hora_fin = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;

  // 1b. Restricción estricta de hora del sistema: prohibido agendar en fechas u horas pasadas del mismo día
  const { fechaHoy, horaActual, minutosActuales } = obtenerFechaHoraSistema();
  if (fecha < fechaHoy) {
    return { ok: false, errorMsg: 'No se puede reservar en una fecha pasada.' };
  }
  if (fecha === fechaHoy && startMin <= minutosActuales) {
    return {
      ok: false,
      errorMsg: `No se puede agendar un horario pasado o en curso del día de hoy (${hora_inicio}). Hora actual del sistema: ${horaActual} hrs.`,
    };
  }

  // 2. Verificar que el slot cabe dentro del horario laboral del día
  const diaSemana = getDayOfWeek(fecha);
  let horariosSemanales = MOCK_DISPONIBILIDAD.filter(
    (h) => h.estilista_id === estilista_id || h.estilista_id === estMockId || h.estilista_id === estMockIdResolved
  );

  if (horariosSemanales.length === 0 && supabase) {
    try {
      const { data, error } = await supabase
        .from('disponibilidad')
        .select('dia_semana, hora_inicio, hora_fin')
        .eq('estilista_id', estNum !== null ? estNum : estilista_id);
      if (!error && Array.isArray(data) && data.length > 0) horariosSemanales = data;
    } catch (_) {}
  }

  // Fallback estándar (Lunes a Sábado 09:00 - 19:00) solo si el estilista no tiene horario semanal registrado
  if (horariosSemanales.length === 0) {
    horariosSemanales = [1, 2, 3, 4, 5, 6].map((dia) => ({
      dia_semana: dia,
      hora_inicio: '09:00',
      hora_fin: '19:00',
    }));
  }

  const horarios = horariosSemanales.filter((h) => Number(h.dia_semana) === diaSemana);

  if (horarios.length === 0) {
    return { ok: false, errorMsg: 'El estilista seleccionado no atiende ese día.' };
  }

  const dentroDeHorario = horarios.some(
    (h) => startMin >= timeToMinutes(h.hora_inicio) && endMin <= timeToMinutes(h.hora_fin)
  );

  if (!dentroDeHorario) {
    return { ok: false, errorMsg: `El horario ${hora_inicio}–${hora_fin} queda fuera de la jornada laboral del estilista.` };
  }

  // 2b. Verificar bloqueos administrativos activos (día completo o rango horario)
  const bloqueosDelDia = await obtenerBloqueosAplicables({
    estilista_id: estMockIdResolved,
    estilista_nombre: estilistaNombreDb,
    fecha,
  });
  const evalBloqueo = evaluarBloqueoParaSlot({
    bloqueos: bloqueosDelDia,
    startMin,
    endMin,
  });
  if (evalBloqueo.bloqueado) {
    const detalle = evalBloqueo.motivo ? ` (${evalBloqueo.motivo})` : '';
    return {
      ok: false,
      errorMsg: evalBloqueo.diaCompleto
        ? `La fecha ${fecha} no está disponible para reservas${detalle}.`
        : `El horario ${hora_inicio}–${hora_fin} se encuentra bloqueado por administración${detalle}.`,
    };
  }

  // 3. Verificar conflictos con otras reservas del día
  let reservasDelDia = [];

  if (supabase) {
    const inicioDia = `${fecha}T00:00:00-03:00`;
    const finDia = `${fecha}T23:59:59-03:00`;
    let q = supabase
      .from('reservas')
      .select('id, fecha_hora_inicio, fecha_hora_fin')
      .eq('estilista_id', estNum !== null ? estNum : 1)
      .gte('fecha_hora_inicio', inicioDia)
      .lte('fecha_hora_inicio', finDia)
      .in('estado', ['pendiente', 'confirmada']);

    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    if (data && data.length > 0) {
      reservasDelDia = data.map((r) => ({
        hora_inicio: extraerHoraChile(r.fecha_hora_inicio),
        hora_fin: extraerHoraChile(r.fecha_hora_fin),
      }));
    }
  } else {
    reservasDelDia = reservasEnMemoria.filter(
      (r) =>
        (r.estilista_id === estilista_id || r.estilista_id === estMockId) &&
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

    // Normalizar teléfono canónico E.164 para WhatsApp
    const telefonoNormalizado = normalizarTelefonoChileno(cliente_telefono);

    // No permitir fechas ni horas pasadas del día actual
    const { fechaHoy: hoy, horaActual, minutosActuales } = obtenerFechaHoraSistema();
    if (fecha < hoy) {
      return res.status(400).json({ status: 'error', message: 'No se puede reservar en una fecha pasada.' });
    }
    if (fecha === hoy && timeToMinutes(hora_inicio) <= minutosActuales) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede confirmar un horario pasado del día de hoy (${hora_inicio}). Hora actual del sistema: ${horaActual} hrs.`,
      });
    }

    // Validar slot
    const validacion = await validarSlot({ estilista_id, servicio_id, fecha, hora_inicio });
    if (!validacion.ok) {
      return res.status(409).json({ status: 'error', message: validacion.errorMsg });
    }

    const { hora_fin } = validacion;

    if (supabase) {
      // Buscar o crear cliente en Supabase sin sobrescribir credenciales existentes (prevención de Account/Booking Takeover)
      const cleanEmail = cliente_email.trim().toLowerCase();
      let clienteData = null;

      let clienteExistente = null;
      const { data: clientesPorEmail } = await supabase
        .from('clientes')
        .select('id, nombre_completo, email, telefono_whatsapp')
        .eq('email', cleanEmail)
        .order('id', { ascending: false })
        .limit(1);

      if (Array.isArray(clientesPorEmail) && clientesPorEmail.length > 0) {
        clienteExistente = clientesPorEmail[0];
      }

      if (clienteExistente) {
        // Solo completamos campos faltantes (ej. si no tenía teléfono registrado); nunca sobrescribimos un teléfono o email existente desde un endpoint público sin autenticar
        const patchCliente = {};
        if (!clienteExistente.telefono_whatsapp && telefonoNormalizado) {
          patchCliente.telefono_whatsapp = telefonoNormalizado;
        }
        if (!clienteExistente.email && cleanEmail) {
          patchCliente.email = cleanEmail;
        }
        if (Object.keys(patchCliente).length > 0) {
          const { data: updated } = await supabase
            .from('clientes')
            .update(patchCliente)
            .eq('id', clienteExistente.id)
            .select('id, nombre_completo, email, telefono_whatsapp')
            .single();
          clienteData = updated || clienteExistente;
        } else {
          clienteData = clienteExistente;
        }
      } else {
        const { data: created, error: errCreateCliente } = await supabase
          .from('clientes')
          .insert({
            nombre_completo: cliente_nombre.trim(),
            email: cleanEmail,
            telefono_whatsapp: telefonoNormalizado,
          })
          .select('id, nombre_completo, email, telefono_whatsapp')
          .single();

        if (!errCreateCliente && created) {
          clienteData = created;
        } else if (telefonoNormalizado) {
          // Fallback: si la tabla tuviera restricción UNIQUE en telefono_whatsapp o condición de carrera en email
          const { data: clientesFallback } = await supabase
            .from('clientes')
            .select('id, nombre_completo, email, telefono_whatsapp')
            .or(`email.eq.${cleanEmail},telefono_whatsapp.eq.${telefonoNormalizado}`)
            .order('id', { ascending: false })
            .limit(1);
          if (Array.isArray(clientesFallback) && clientesFallback.length > 0) {
            clienteData = clientesFallback[0];
          }
        }
      }

      if (clienteData) {
        // En Supabase reservas maneja timestamps ISO (timestamptz)
        const fecha_hora_inicio = `${fecha}T${hora_inicio}:00-03:00`;
        const fecha_hora_fin = `${fecha}T${hora_fin}:00-03:00`;

        const { data: reserva, error: errReserva } = await supabase
          .from('reservas')
          .insert({
            cliente_id: clienteData.id,
            estilista_id: isNaN(estilista_id) ? 1 : Number(estilista_id),
            servicio_id: isNaN(servicio_id) ? 2 : Number(servicio_id),
            fecha_hora_inicio,
            fecha_hora_fin,
            estado: 'pendiente',
          })
          .select('*, clientes(nombre_completo, email, telefono_whatsapp), estilistas(nombre, especialidad), servicios(nombre, precio, duracion_min)')
          .single();

        if (errReserva) {
          console.error('[Supabase] Error al insertar en tabla reservas:', errReserva);
        }

        if (errReserva && (errReserva.code === '23P01' || errReserva.code === '23505')) {
          return res.status(409).json({
            status: 'error',
            message: 'El horario seleccionado acaba de ser ocupado por otra reserva. Por favor selecciona otro horario.',
          });
        }

        if (!errReserva && reserva) {
          const codigoReserva = generarCodigoReserva(reserva.id, fecha_hora_inicio, fecha, hora_inicio);
          await persistirCodigoEnSupabase(reserva.id, codigoReserva);

          const payloadEnriquecido = formatearReservaParaRespuesta({
            ...reserva,
            codigo_reserva: codigoReserva,
            cliente_nombre: reserva.clientes?.nombre_completo || cliente_nombre.trim(),
            cliente_email: reserva.clientes?.email || cleanEmail,
            cliente_telefono: reserva.clientes?.telefono_whatsapp || telefonoNormalizado,
            fecha,
            hora_inicio,
            hora_fin,
          });

          // Disparar automatización n8n de forma asíncrona hacia el Router / PC01
          despacharEventoN8N('reserva_creada', payloadEnriquecido);

          return res.status(201).json({ status: 'success', data: payloadEnriquecido });
        }
      } else {
        console.error('[Supabase] No se pudo obtener ni insertar registro en tabla clientes para:', cleanEmail);
      }
    }

    // Fallback mock — guardar en memoria
    const svc = MOCK_SERVICIOS.find((s) => s.id === servicio_id);
    let est = MOCK_ESTILISTAS.find((e) => String(e.id) === String(estilista_id));
    if (!est) {
      try {
        const { items: equipo } = await obtenerEquipoCompleto();
        est = equipo.find((e) => String(e.id) === String(estilista_id));
      } catch (_) {}
    }
    const newId = uuidv4();
    const codigoReservaMock = generarCodigoReserva(newId, null, fecha, hora_inicio);

    const nuevaReserva = {
      id: newId,
      codigo_reserva: codigoReservaMock,
      cliente_nombre: cliente_nombre.trim(),
      cliente_email,
      cliente_telefono: telefonoNormalizado,
      estilista_id,
      estilista_nombre: est ? `${est.nombre} ${est.apellido || ''}`.trim() : estilista_id,
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

    const respuestaMock = formatearReservaParaRespuesta(nuevaReserva);
    despacharEventoN8N('reserva_creada', respuestaMock);

    return res.status(201).json({
      status: 'success',
      source: 'mock',
      data: respuestaMock,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Enriquece y normaliza la reserva con datos legibles para el panel de administración y autogestión:
 * codigo_reserva (PC-XX-XXXX), fecha (YYYY-MM-DD), hora_inicio (HH:mm), hora_fin (HH:mm),
 * cliente_nombre, cliente_email, cliente_telefono, servicio_nombre, estilista_nombre, gestion_token
 */
const formatearReservaParaRespuesta = (r) => {
  let fecha = r.fecha || null;
  let hora_inicio = r.hora_inicio || null;
  let hora_fin = r.hora_fin || null;

  if (r.fecha_hora_inicio) {
    const dtInicio = new Date(r.fecha_hora_inicio);
    const optionsFecha = { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' };

    const formatterFecha = new Intl.DateTimeFormat('es-CL', optionsFecha);
    const parts = formatterFecha.formatToParts(dtInicio);
    const yyyy = parts.find((p) => p.type === 'year')?.value;
    const mm = parts.find((p) => p.type === 'month')?.value;
    const dd = parts.find((p) => p.type === 'day')?.value;
    fecha = `${yyyy}-${mm}-${dd}`;

    hora_inicio = extraerHoraChile(r.fecha_hora_inicio);

    if (r.fecha_hora_fin) {
      hora_fin = extraerHoraChile(r.fecha_hora_fin);
    }
  }

  const clienteNombre = r.clientes?.nombre_completo || r.cliente_nombre || '—';
  const clienteEmail = r.clientes?.email || r.cliente_email || '—';
  const clienteTelefono = r.clientes?.telefono_whatsapp || r.cliente_telefono || '—';
  const servicioNombre = r.servicios?.nombre || r.servicio_nombre || null;
  const estilistaNombre = r.estilistas
    ? `${r.estilistas.nombre} ${r.estilistas.apellido || ''}`.trim()
    : r.estilista_nombre || null;

  const codigoReserva =
    r.codigo_reserva ||
    generarCodigoReserva(r.id, r.fecha_hora_inicio, fecha, hora_inicio);

  return {
    ...r,
    codigo_reserva: codigoReserva,
    ...(r.codigo_reserva_anterior ? { codigo_reserva_anterior: r.codigo_reserva_anterior } : {}),
    fecha,
    hora_inicio,
    hora_fin,
    cliente_nombre: clienteNombre,
    cliente_email: clienteEmail,
    cliente_telefono: clienteTelefono,
    servicio_nombre: servicioNombre,
    estilista_nombre: estilistaNombre,
    gestion_token: generarTokenReserva(r.id),
  };
};

/**
 * Listar reservas
 * GET /api/v1/reservas
 * Query: estilista_id, fecha, fecha_desde, fecha_hasta, estado, codigo_reserva
 */
const getReservas = async (req, res, next) => {
  try {
    const { estilista_id, fecha, fecha_desde, fecha_hasta, estado, codigo_reserva } = req.query;
    const isIsoDate = (val) => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());

    const fechaExacta = isIsoDate(fecha) ? fecha.trim() : null;
    const desde = isIsoDate(fecha_desde) ? fecha_desde.trim() : null;
    const hasta = isIsoDate(fecha_hasta) ? fecha_hasta.trim() : null;

    if (supabase) {
      let q = supabase
        .from('reservas')
        .select('*, clientes(nombre_completo, email, telefono_whatsapp), estilistas(nombre, especialidad), servicios(nombre, precio, duracion_min)');
      if (estilista_id) q = q.eq('estilista_id', isNaN(estilista_id) ? 1 : Number(estilista_id));
      if (fechaExacta) {
        q = q.gte('fecha_hora_inicio', `${fechaExacta}T00:00:00-03:00`).lte('fecha_hora_inicio', `${fechaExacta}T23:59:59-03:00`);
      } else {
        if (desde) q = q.gte('fecha_hora_inicio', `${desde}T00:00:00-03:00`);
        if (hasta) q = q.lte('fecha_hora_inicio', `${hasta}T23:59:59-03:00`);
      }
      if (estado) q = q.eq('estado', estado);

      const { data, error } = await q.order('fecha_hora_inicio', { ascending: false });
      if (!error && data) {
        let reservasFormateadas = data.map(formatearReservaParaRespuesta);
        if (codigo_reserva) {
          const term = String(codigo_reserva).trim().toUpperCase();
          reservasFormateadas = reservasFormateadas.filter(
            (r) => String(r.codigo_reserva || '').toUpperCase().includes(term) || String(r.id) === term
          );
        }
        return res.status(200).json({ status: 'success', count: reservasFormateadas.length, data: reservasFormateadas });
      }
    }

    // Fallback mock
    let reservas = [...reservasEnMemoria].map(formatearReservaParaRespuesta);
    if (estilista_id) reservas = reservas.filter((r) => r.estilista_id === estilista_id);
    if (fechaExacta) {
      reservas = reservas.filter((r) => r.fecha === fechaExacta);
    } else {
      if (desde) reservas = reservas.filter((r) => r.fecha && r.fecha >= desde);
      if (hasta) reservas = reservas.filter((r) => r.fecha && r.fecha <= hasta);
    }
    if (estado) reservas = reservas.filter((r) => r.estado === estado);
    if (codigo_reserva) {
      const term = String(codigo_reserva).trim().toUpperCase();
      reservas = reservas.filter(
        (r) => String(r.codigo_reserva || '').toUpperCase().includes(term) || String(r.id) === term
      );
    }

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
 * Obtener una reserva por ID o por Código de Reserva (PC-XX-XXXX)
 * GET /api/v1/reservas/:id
 */
const getReservaById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reserva = await getReservaRawById(id);

    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    return res.status(200).json({
      status: 'success',
      source: supabase ? 'supabase' : 'mock',
      data: formatearReservaParaRespuesta(reserva),
    });
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

    const reserva = await getReservaRawById(id);

    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    const targetId = reserva.id;
    const codigoActual = resolverCodigoReserva(reserva);

    const esSolicitudCliente = ['cliente_token', 'cliente_titular', 'whatsapp_cliente'].includes(req.authSource);

    if (esSolicitudCliente && reserva.estado === 'confirmada') {
      return res.status(409).json({
        status: 'error',
        message: 'Esta reserva ya fue confirmada por la administración y no puede ser cancelada desde el formulario.',
      });
    }

    if (!['pendiente', 'confirmada'].includes(reserva.estado)) {
      return res.status(409).json({
        status: 'error',
        message: `Solo se pueden cancelar reservas en estado 'pendiente' o 'confirmada'. Estado actual: '${reserva.estado}'.`,
      });
    }

    // Verificar ventana de 12 horas de forma robusta (soporta timestamptz ISO y string fecha+hora)
    let fechaHoraTurno;
    if (reserva.fecha_hora_inicio) {
      fechaHoraTurno = new Date(reserva.fecha_hora_inicio);
    } else {
      fechaHoraTurno = new Date(`${reserva.fecha}T${reserva.hora_inicio}:00`);
    }

    const ahora = new Date();
    const diffMs = fechaHoraTurno.getTime() - ahora.getTime();
    const diffHoras = diffMs / (1000 * 60 * 60);

    if (diffHoras < CANCELATION_HOURS) {
      return res.status(409).json({
        status: 'error',
        message: `Las cancelaciones deben realizarse al menos ${CANCELATION_HOURS} horas antes del turno.`,
      });
    }

    // Actualizar estado en Supabase
    if (supabase) {
      const { data: updated, error } = await supabase
        .from('reservas')
        .update({ estado: 'cancelada' })
        .eq('id', targetId)
        .select('*, clientes(nombre_completo, email, telefono_whatsapp), servicios(nombre), estilistas(nombre)')
        .single();

      if (!error && updated) {
        const formatted = formatearReservaParaRespuesta({
          ...updated,
          codigo_reserva: updated.codigo_reserva || codigoActual,
        });
        despacharEventoN8N('reserva_cancelada', formatted);
        return res.status(200).json({ status: 'success', data: formatted });
      }
    }

    // Fallback mock
    reservasEnMemoria = reservasEnMemoria.map((r) =>
      String(r.id) === String(targetId) ? { ...r, estado: 'cancelada', codigo_reserva: codigoActual } : r
    );
    const cancelada = formatearReservaParaRespuesta(
      reservasEnMemoria.find((r) => String(r.id) === String(targetId))
    );

    despacharEventoN8N('reserva_cancelada', cancelada);

    return res.status(200).json({ status: 'success', source: 'mock', data: cancelada });
  } catch (err) {
    next(err);
  }
};

/**
 * Confirmar una reserva (uso admin)
 * PATCH /api/v1/reservas/:id/confirmar
 * Al confirmar desde el panel de administración, despacha automáticamente el evento
 * hacia n8n (PC06 -> PC05) para enviar el mensaje y enlace de encuesta de satisfacción por WhatsApp y Gmail.
 */
const confirmarReserva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reserva = await getReservaRawById(id);

    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    const targetId = reserva.id;
    const codigoActual = resolverCodigoReserva(reserva);

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
        .eq('id', targetId)
        .select('*, clientes(nombre_completo, email, telefono_whatsapp), servicios(nombre), estilistas(nombre)')
        .single();
      if (!error && updated) {
        const formatted = formatearReservaParaRespuesta({
          ...updated,
          codigo_reserva: updated.codigo_reserva || codigoActual,
        });
        despacharEventoN8N('reserva_confirmada', formatted);
        return res.status(200).json({ status: 'success', data: formatted });
      }
    }

    reservasEnMemoria = reservasEnMemoria.map((r) =>
      String(r.id) === String(targetId) ? { ...r, estado: 'confirmada', codigo_reserva: codigoActual } : r
    );
    const confirmada = formatearReservaParaRespuesta(
      reservasEnMemoria.find((r) => String(r.id) === String(targetId))
    );

    despacharEventoN8N('reserva_confirmada', confirmada);

    return res.status(200).json({ status: 'success', source: 'mock', data: confirmada });
  } catch (err) {
    next(err);
  }
};

/**
 * Reprogramar una reserva (genera y persiste un NUEVO código de reserva)
 * PATCH /api/v1/reservas/:id/reprogramar
 * Body: { fecha, hora_inicio, notas }
 */
const reprogramarReserva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha, hora_inicio, notas } = req.body;

    if (!fecha || !hora_inicio) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe especificar nueva fecha y hora_inicio para reprogramar.',
      });
    }

    const { fechaHoy: hoy, horaActual, minutosActuales } = obtenerFechaHoraSistema();
    if (fecha < hoy) {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede reprogramar a una fecha pasada.',
      });
    }
    if (fecha === hoy && timeToMinutes(hora_inicio) <= minutosActuales) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede reprogramar a un horario pasado del día de hoy (${hora_inicio}). Hora actual del sistema: ${horaActual} hrs.`,
      });
    }

    const reserva = await getReservaRawById(id);

    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    const targetId = reserva.id;
    const codigoAnterior = resolverCodigoReserva(reserva);
    const esSolicitudCliente = ['cliente_token', 'cliente_titular', 'whatsapp_cliente'].includes(req.authSource);

    if (esSolicitudCliente && reserva.estado === 'confirmada') {
      return res.status(409).json({
        status: 'error',
        message: 'Esta reserva ya fue confirmada por la administración y no puede ser reprogramada desde el formulario.',
      });
    }

    if (['cancelada', 'atendida', 'completada', 'no_asistio'].includes(reserva.estado)) {
      return res.status(409).json({
        status: 'error',
        message: `No se puede reprogramar una reserva con estado '${reserva.estado}'.`,
      });
    }

    // Validar nuevo slot para el mismo estilista y servicio
    const validacion = await validarSlot({
      estilista_id: reserva.estilista_id,
      servicio_id: reserva.servicio_id,
      fecha,
      hora_inicio,
      excludeId: targetId,
    });

    if (!validacion.ok) {
      return res.status(409).json({ status: 'error', message: validacion.errorMsg });
    }

    const { hora_fin } = validacion;
    const fecha_hora_inicio = `${fecha}T${hora_inicio}:00-03:00`;
    const fecha_hora_fin = `${fecha}T${hora_fin}:00-03:00`;

    // Generar NUEVO código de reserva vinculado al nuevo horario
    let nuevoCodigoReserva = generarCodigoReserva(targetId, fecha_hora_inicio, fecha, hora_inicio);
    if (nuevoCodigoReserva === codigoAnterior) {
      const saltSuffix = Math.floor(1000 + Math.random() * 9000).toString(36).toUpperCase().slice(-4);
      nuevoCodigoReserva = `PC-${String(targetId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-${saltSuffix}`;
    }

    if (supabase) {
      const { data: updated, error } = await supabase
        .from('reservas')
        .update({
          fecha_hora_inicio,
          fecha_hora_fin,
          estado: 'pendiente',
        })
        .eq('id', targetId)
        .select('*, clientes(nombre_completo, email, telefono_whatsapp), servicios(nombre), estilistas(nombre)')
        .single();

      if (!error && updated) {
        await persistirCodigoEnSupabase(targetId, nuevoCodigoReserva);

        const formatted = formatearReservaParaRespuesta({
          ...updated,
          codigo_reserva: nuevoCodigoReserva,
          codigo_reserva_anterior: codigoAnterior,
          fecha,
          hora_inicio,
          hora_fin,
        });
        despacharEventoN8N('reserva_reprogramada', formatted);
        return res.status(200).json({ status: 'success', data: formatted });
      }
    }

    // Fallback mock
    reservasEnMemoria = reservasEnMemoria.map((r) =>
      String(r.id) === String(targetId)
        ? {
            ...r,
            codigo_reserva: nuevoCodigoReserva,
            codigo_reserva_anterior: codigoAnterior,
            fecha,
            hora_inicio,
            hora_fin,
            notas: notas !== undefined ? notas : r.notas,
            estado: 'pendiente',
            updated_at: new Date().toISOString(),
          }
        : r
    );

    const reprogramada = formatearReservaParaRespuesta(
      reservasEnMemoria.find((r) => String(r.id) === String(targetId))
    );
    despacharEventoN8N('reserva_reprogramada', reprogramada);

    return res.status(200).json({ status: 'success', source: 'mock', data: reprogramada });
  } catch (err) {
    next(err);
  }
};

/**
 * Marcar una reserva como atendida
 * PATCH /api/v1/reservas/:id/atendida
 */
const marcarAtendida = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reserva = await getReservaRawById(id);

    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    const targetId = reserva.id;

    if (['cancelada', 'no_asistio'].includes(reserva.estado)) {
      return res.status(409).json({
        status: 'error',
        message: `No se puede marcar como atendida una reserva con estado '${reserva.estado}'.`,
      });
    }

    if (supabase) {
      const { data: updated, error } = await supabase
        .from('reservas')
        .update({ estado: 'atendida' })
        .eq('id', targetId)
        .select('*, clientes(nombre_completo, email, telefono_whatsapp), servicios(nombre), estilistas(nombre)')
        .single();

      if (!error && updated) {
        const formatted = formatearReservaParaRespuesta(updated);
        despacharEventoN8N('reserva_atendida', formatted);
        return res.status(200).json({ status: 'success', data: formatted });
      }
    }

    // Fallback mock
    reservasEnMemoria = reservasEnMemoria.map((r) =>
      String(r.id) === String(targetId) ? { ...r, estado: 'atendida' } : r
    );
    const atendida = formatearReservaParaRespuesta(
      reservasEnMemoria.find((r) => String(r.id) === String(targetId))
    );
    despacharEventoN8N('reserva_atendida', atendida);

    return res.status(200).json({ status: 'success', source: 'mock', data: atendida });
  } catch (err) {
    next(err);
  }
};

/**
 * Marcar una reserva como "No asistió" (uso admin)
 * PATCH /api/v1/reservas/:id/no-asistio
 * Permite registrar inasistencia desde estado 'pendiente' o 'confirmada'.
 */
const marcarNoAsistio = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reserva = await getReservaRawById(id);

    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    const targetId = reserva.id;
    const codigoActual = resolverCodigoReserva(reserva);

    if (!['pendiente', 'confirmada'].includes(reserva.estado)) {
      return res.status(409).json({
        status: 'error',
        message: `Solo se puede marcar como 'No asistió' una reserva en estado 'pendiente' o 'confirmada'. Estado actual: '${reserva.estado}'.`,
      });
    }

    if (supabase) {
      const { data: updated, error } = await supabase
        .from('reservas')
        .update({ estado: 'no_asistio' })
        .eq('id', targetId)
        .select('*, clientes(nombre_completo, email, telefono_whatsapp), servicios(nombre, precio, duracion_min), estilistas(nombre, especialidad)')
        .single();

      if (error) {
        console.error('[Supabase] Error al marcar reserva como no_asistio:', error);
        return res.status(500).json({
          status: 'error',
          message: 'No se pudo actualizar el estado a "No asistió" en la base de datos. Verifica que la migración 007 haya sido ejecutada.',
        });
      }

      if (updated) {
        const formatted = formatearReservaParaRespuesta({
          ...updated,
          codigo_reserva: updated.codigo_reserva || codigoActual,
        });
        return res.status(200).json({ status: 'success', data: formatted });
      }
    }

    // Fallback mock
    reservasEnMemoria = reservasEnMemoria.map((r) =>
      String(r.id) === String(targetId)
        ? { ...r, estado: 'no_asistio', codigo_reserva: codigoActual }
        : r
    );
    const actualizada = formatearReservaParaRespuesta(
      reservasEnMemoria.find((r) => String(r.id) === String(targetId))
    );

    return res.status(200).json({ status: 'success', source: 'mock', data: actualizada });
  } catch (err) {
    next(err);
  }
};

/**
 * Lógica interna para el barrido de citas vencidas.
 * Se invoca tanto desde el controlador HTTP como desde el worker cron en background.
 * Acota el barrido a una ventana reciente (por defecto últimos 3 días) para no sobrescribir
 * registros históricos o semillas de meses cerrados.
 */
const cerrarCitasCumplidasInternal = async () => {
  const ahora = new Date();
  const ahoraIso = ahora.toISOString();
  const lookbackDays = Math.max(1, Number(process.env.CRON_LOOKBACK_DAYS) || 3);
  const ventanaInicio = new Date(ahora.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const ventanaInicioIso = ventanaInicio.toISOString();
  let actualizadas = [];

  if (supabase) {
    // 1. Buscar citas recientes en Supabase cuya hora de fin ya pasó y están confirmadas o pendientes
    const { data: citas, error: errSearch } = await supabase
      .from('reservas')
      .select('*, clientes(nombre_completo, email, telefono_whatsapp), servicios(nombre), estilistas(nombre)')
      .gte('fecha_hora_fin', ventanaInicioIso)
      .lte('fecha_hora_fin', ahoraIso)
      .in('estado', ['confirmada', 'pendiente']);

    if (!errSearch && citas && citas.length > 0) {
      for (const cita of citas) {
        const { data: updated, error: errUpd } = await supabase
          .from('reservas')
          .update({ estado: 'atendida' })
          .eq('id', cita.id)
          .select('*, clientes(nombre_completo, email, telefono_whatsapp), servicios(nombre), estilistas(nombre)')
          .single();

        if (!errUpd && updated) {
          despacharEventoN8N('reserva_atendida', updated);
          actualizadas.push(updated);
        }
      }
    }
  } else {
    // Fallback Mock
    const ahoraMs = ahora.getTime();
    const ventanaInicioMs = ventanaInicio.getTime();
    reservasEnMemoria = reservasEnMemoria.map((r) => {
      let dFin;
      if (r.fecha_hora_fin) {
        dFin = new Date(r.fecha_hora_fin).getTime();
      } else {
        dFin = new Date(`${r.fecha}T${r.hora_fin}:00`).getTime();
      }
      if (dFin >= ventanaInicioMs && dFin <= ahoraMs && ['confirmada', 'pendiente'].includes(r.estado)) {
        const up = { ...r, estado: 'atendida' };
        despacharEventoN8N('reserva_atendida', up);
        actualizadas.push(up);
        return up;
      }
      return r;
    });
  }

  return {
    total_procesadas: actualizadas.length,
    data: actualizadas,
  };
};

/**
 * Endpoint de barrido manual o programado para cerrar citas cumplidas.
 * POST /api/v1/reservas/cron/cerrar-atendidas
 */
const cerrarCitasCumplidas = async (req, res, next) => {
  try {
    const resultado = await cerrarCitasCumplidasInternal();
    return res.status(200).json({
      status: 'success',
      ...resultado,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Endpoint de invocación de recordatorios 24h (Pilar C).
 * POST /api/v1/reservas/cron/recordatorios-24h
 */
const ejecutarRecordatorios24h = async (req, res, next) => {
  try {
    const n8nRecordatorioUrl = process.env.N8N_RECORDATORIO_URL || 'http://localhost:5678/webhook/pc02-test-recordatorio';
    const n8nRes = await fetch(n8nRecordatorioUrl, {
      method: 'POST',
      headers: buildN8nHeaders(),
      body: JSON.stringify(req.body || {}),
    });

    const raw = await n8nRes.text();
    let data;
    try { data = JSON.parse(raw); } catch (_) { data = raw; }

    return res.status(200).json({
      status: 'success',
      n8n_status: n8nRes.status,
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verificación de Webhook de Meta WhatsApp Cloud API (GET /api/v1/reservas/whatsapp-webhook)
 */
const verificarWebhookWhatsApp = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken =
    process.env.WHATSAPP_VERIFY_TOKEN ||
    (process.env.NODE_ENV === 'production' ? null : 'peluqueria_carolina_wa_verify_2026');

  if (mode === 'subscribe' && token && expectedToken && safeCompareStrings(token, expectedToken)) {
    return res.status(200).send(String(challenge || ''));
  }
  return res.status(403).json({ status: 'error', message: 'Token de verificación de WhatsApp inválido.' });
};

/**
 * Verifica si la petición al webhook de WhatsApp cuenta con firma HMAC-SHA256 válida de Meta
 * o con autorización interna/administrativa (x-api-key / Bearer admin).
 */
const verificarAutenticidadWebhookWhatsApp = (req) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && process.env.INTERNAL_API_KEY && safeCompareStrings(apiKey, process.env.INTERNAL_API_KEY)) {
    return { ok: true, isTrustedInternal: true };
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (verificarTokenAdmin(token)) {
      return { ok: true, isTrustedInternal: true };
    }
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const signatureHeader = req.headers['x-hub-signature-256'];

  if (appSecret) {
    if (!signatureHeader || typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=') || !req.rawBody) {
      return { ok: false, reason: 'Falta firma X-Hub-Signature-256 de Meta WhatsApp Cloud API.' };
    }
    const expectedSig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
    if (!safeCompareStrings(signatureHeader, expectedSig)) {
      return { ok: false, reason: 'Firma X-Hub-Signature-256 inválida.' };
    }
    return { ok: true, isTrustedInternal: false };
  }

  if (process.env.NODE_ENV === 'production') {
    return { ok: false, reason: 'WHATSAPP_APP_SECRET o INTERNAL_API_KEY requerido en producción.' };
  }

  return { ok: true, isTrustedInternal: false };
};

/**
 * Procesador de los 2 Botones Interactivos de WhatsApp (POST /api/v1/reservas/whatsapp-webhook)
 * Soporta payloads nativos de Meta Cloud API (`entry[0].changes[0].value.messages[0]`)
 * y payloads normalizados desde n8n (`{ accion, button_id, reserva_id, codigo_reserva, telefono }`).
 *
 * Botón 1: [ Cancelar Cita ] -> Cancela en 1 clic, libera horario, actualiza BD/Admin y envía confirmación.
 * Botón 2: [ Reprogramar Cita ] -> Entrega Magic Link firmado (o reprograma directo si incluye fecha/hora) generando nuevo código.
 */
const procesarWebhookWhatsApp = async (req, res, next) => {
  try {
    const authCheck = verificarAutenticidadWebhookWhatsApp(req);
    if (!authCheck.ok) {
      return res.status(401).json({
        status: 'error',
        message: authCheck.reason,
      });
    }

    const body = req.body || {};
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

    // 1. Extraer mensaje desde estructura nativa de Meta Cloud API o payload directo de n8n
    const metaMsg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const remitenteRaw =
      metaMsg?.from ||
      body.telefono ||
      body.from ||
      body.cliente_telefono ||
      '';
    const telefonoRemitente = normalizarTelefonoChileno(remitenteRaw);

    const buttonId =
      metaMsg?.interactive?.button_reply?.id ||
      metaMsg?.button?.payload ||
      body.button_id ||
      body.payload ||
      '';

    const textBody = (
      metaMsg?.text?.body ||
      metaMsg?.interactive?.button_reply?.title ||
      metaMsg?.button?.text ||
      body.texto ||
      ''
    ).trim();

    let accion = (body.accion || '').toLowerCase();
    let targetIdentifier = body.codigo_reserva || body.reserva_id || '';

    // Parsear buttonId con formato "btn_cancelar:<id>:<codigo>" o "btn_reprogramar:<id>:<codigo>"
    if (buttonId) {
      const parts = String(buttonId).split(':');
      if (parts[0] === 'btn_cancelar' || parts[0] === 'cancelar') {
        accion = 'cancelar';
        targetIdentifier = parts[2] || parts[1] || targetIdentifier;
      } else if (parts[0] === 'btn_reprogramar' || parts[0] === 'reprogramar') {
        accion = 'reprogramar';
        targetIdentifier = parts[2] || parts[1] || targetIdentifier;
      }
    }

    // Parsear texto libre o título de botón ("Cancelar Cita PC-18-XXXX" / "Reprogramar Cita PC-18-XXXX")
    if (!accion && textBody) {
      const upper = textBody.toUpperCase();
      const codeMatch = upper.match(/PC-[A-Z0-9]+-[A-Z0-9]{4}/);
      if (codeMatch) targetIdentifier = targetIdentifier || codeMatch[0];

      if (upper.includes('CANCELAR')) accion = 'cancelar';
      else if (upper.includes('REPROGRAMAR') || upper.includes('CAMBIAR')) accion = 'reprogramar';
    }

    if (!accion || !['cancelar', 'reprogramar'].includes(accion)) {
      return res.status(200).json({
        status: 'ignored',
        message: 'Evento de WhatsApp recibido sin acción de cancelación o reprogramación.',
      });
    }

    if (!targetIdentifier) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe indicar el código de reserva (ej. PC-18-XXXX) o reserva_id.',
      });
    }

    const reserva = await getReservaRawById(targetIdentifier);
    if (!reserva) {
      return res.status(404).json({
        status: 'error',
        message: `No se encontró la reserva con código '${targetIdentifier}'.`,
      });
    }

    // Verificar titularidad obligatoria por número de WhatsApp remitente (salvo invocación administrativa autenticada)
    const telTitular = normalizarTelefonoChileno(
      reserva.clientes?.telefono_whatsapp || reserva.cliente_telefono || ''
    );
    if (!authCheck.isTrustedInternal) {
      if (!telefonoRemitente || !telTitular || !safeCompareStrings(telefonoRemitente, telTitular)) {
        return res.status(403).json({
          status: 'error',
          message: 'El número de WhatsApp remitente es obligatorio y debe coincidir con el titular de la reserva.',
        });
      }
    }

    const formattedActual = formatearReservaParaRespuesta(reserva);
    req.authSource = 'whatsapp_cliente';

    if (reserva.estado === 'confirmada') {
      return res.status(409).json({
        status: 'error',
        message: 'Esta reserva ya fue confirmada por la administración y no puede ser reprogramada ni cancelada.',
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACCIÓN 1: BOTÓN [ CANCELAR CITA ] EN WHATSAPP
    // ─────────────────────────────────────────────────────────────────────────
    if (accion === 'cancelar') {
      req.params.id = String(reserva.id);
      return cancelarReserva(req, res, next);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACCIÓN 2: BOTÓN [ REPROGRAMAR CITA ] EN WHATSAPP
    // ─────────────────────────────────────────────────────────────────────────
    if (body.fecha && body.hora_inicio) {
      req.params.id = String(reserva.id);
      return reprogramarReserva(req, res, next);
    }

    const urlReprogramar = `${frontendUrl}/?reserva=${encodeURIComponent(formattedActual.codigo_reserva)}&token=${encodeURIComponent(formattedActual.gestion_token)}&accion=reprogramar#reservar`;

    return res.status(200).json({
      status: 'success',
      accion: 'reprogramar',
      codigo_reserva: formattedActual.codigo_reserva,
      reserva_id: String(formattedActual.id),
      url_reprogramar: urlReprogramar,
      mensaje_whatsapp: `✨ ¡Hola ${formattedActual.cliente_nombre}! Para elegir tu nueva fecha y horario para la reserva *${formattedActual.codigo_reserva}*, ingresa directamente aquí:\n👉 ${urlReprogramar}\n\nAl confirmar el cambio recibirás tu nuevo código de reserva.`,
      data: formattedActual,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Enmascara el nombre completo de un cliente (ej. "Benjamín Peña" -> "Benjamín P.")
 * cuando se consulta la encuesta mediante ID numérico secuencial sin token HMAC.
 */
const enmascararNombreCliente = (nombre) => {
  if (!nombre || typeof nombre !== 'string') return 'Cliente';
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[1].charAt(0).toUpperCase()}.`;
};

/**
 * Verifica si la consulta/envío de encuesta incluye prueba criptográfica de posesión
 * (token HMAC válido, código de reserva completo PC-XX-XXXX, o sesión de administrador).
 */
const tieneAccesoVerificadoEncuesta = (req, reserva, formatted) => {
  const token = req.query?.token || req.body?.token || req.headers['x-reserva-token'] || '';
  if (token && verificarTokenReserva(reserva.id, String(token), formatted.codigo_reserva)) {
    return true;
  }
  const parsed = parsearIdentificadorReserva(req.params.id);
  if (parsed.isCode && safeCompareStrings(parsed.raw.toUpperCase(), String(formatted.codigo_reserva).toUpperCase())) {
    return true;
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ') && verificarTokenAdmin(authHeader.split(' ')[1])) {
    return true;
  }
  return false;
};

/**
 * Obtener resumen público de la reserva para el formulario de encuesta de satisfacción
 * GET /api/v1/reservas/:id/encuesta
 */
const obtenerInfoEncuesta = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reserva = await getReservaRawById(id);

    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    const formatted = formatearReservaParaRespuesta(reserva);
    const accesoVerificado = tieneAccesoVerificadoEncuesta(req, reserva, formatted);
    let yaRespondida = false;
    let encuestaExistente = null;

    const enc = await obtenerEncuestaPorReservaId(reserva.id);
    if (enc) {
      yaRespondida = true;
      // Solo exponer el texto del comentario si la petición está verificada con token o código
      encuestaExistente = accesoVerificado
        ? {
            id: enc.id,
            puntaje: enc.puntaje,
            comentario: enc.comentario,
            respondida_en: enc.respondida_en,
          }
        : { id: enc.id, puntaje: enc.puntaje, respondida_en: enc.respondida_en };
    }

    return res.status(200).json({
      status: 'success',
      data: {
        reserva_id: String(formatted.id),
        // Evitar filtración del código secreto PC-XX-XXXX si se enumera por ID secuencial sin token
        codigo_reserva: accesoVerificado ? formatted.codigo_reserva : `PC-***-${String(formatted.codigo_reserva).slice(-2)}`,
        cliente_nombre: accesoVerificado ? formatted.cliente_nombre : enmascararNombreCliente(formatted.cliente_nombre),
        servicio_nombre: formatted.servicio_nombre,
        estilista_nombre: formatted.estilista_nombre,
        fecha: formatted.fecha,
        hora_inicio: formatted.hora_inicio,
        estado: formatted.estado,
        evaluable: ['confirmada', 'atendida'].includes(formatted.estado),
        ya_respondida: yaRespondida,
        encuesta: encuestaExistente,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Registrar respuesta de encuesta de satisfacción a través de n8n (PC06 -> PC08)
 * POST /api/v1/reservas/:id/encuesta
 * Body: { puntaje (1..5), comentario, token? }
 */
const registrarEncuestaSatisfaccion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const puntajeNum = Number(req.body?.puntaje);
    const comentario = typeof req.body?.comentario === 'string' ? req.body.comentario.trim().slice(0, 1000) : '';

    if (!Number.isInteger(puntajeNum) || puntajeNum < 1 || puntajeNum > 5) {
      return res.status(400).json({
        status: 'error',
        message: 'El puntaje debe ser un número entero entre 1 y 5.',
      });
    }

    const reserva = await getReservaRawById(id);
    if (!reserva) {
      return res.status(404).json({ status: 'error', message: `Reserva '${id}' no encontrada.` });
    }

    const formatted = formatearReservaParaRespuesta(reserva);
    const tokenProvided = req.query?.token || req.body?.token || req.headers['x-reserva-token'];
    if (tokenProvided && !tieneAccesoVerificadoEncuesta(req, reserva, formatted)) {
      return res.status(403).json({
        status: 'error',
        message: 'Token de encuesta inválido para esta reserva.',
      });
    }
    if (process.env.NODE_ENV === 'production' && !tieneAccesoVerificadoEncuesta(req, reserva, formatted)) {
      return res.status(401).json({
        status: 'error',
        message: 'Se requiere el enlace oficial con token o código de reserva para registrar la encuesta.',
      });
    }

    if (!['confirmada', 'atendida'].includes(reserva.estado)) {
      return res.status(409).json({
        status: 'error',
        message: 'La reserva aún no puede ser evaluada.',
      });
    }

    const existentePrevio = await obtenerEncuestaPorReservaId(reserva.id);
    if (existentePrevio) {
      return res.status(409).json({
        status: 'error',
        message: 'La encuesta de esta reserva ya fue respondida.',
      });
    }

    const metadataReserva = {
      codigo_reserva: formatted.codigo_reserva,
      cliente_nombre: formatted.cliente_nombre,
      cliente_email: formatted.cliente_email,
      cliente_telefono: formatted.cliente_telefono,
      servicio_id: formatted.servicio_id,
      servicio_nombre: formatted.servicio_nombre,
      estilista_id: formatted.estilista_id,
      estilista_nombre: formatted.estilista_nombre,
      fecha_cita: formatted.fecha,
      hora_inicio: formatted.hora_inicio,
      hora_fin: formatted.hora_fin,
      estado_reserva: formatted.estado,
    };

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/pc06-webhook-router';
    let registradoEnN8n = false;

    try {
      const n8nRes = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: buildN8nHeaders(),
        body: JSON.stringify({
          evento: 'encuesta_respondida',
          reserva_id: String(reserva.id),
          puntaje: puntajeNum,
          comentario,
        }),
      });

      const n8nJson = await n8nRes.json().catch(() => ({}));
      if (!n8nRes.ok || n8nJson.success === false) {
        return res.status(n8nRes.status >= 400 ? n8nRes.status : 400).json({
          status: 'error',
          message: n8nJson.error || 'No fue posible registrar la encuesta de satisfacción.',
        });
      }
      registradoEnN8n = true;
    } catch (n8nErr) {
      console.warn(
        `[Encuestas] n8n no disponible (${n8nErr.message}); persistiendo encuesta directamente en backend.`
      );
    }

    // Asegurar persistencia en Supabase y/o store local para el Panel de Administración
    try {
      await guardarEncuesta({
        reserva_id: String(reserva.id),
        puntaje: puntajeNum,
        comentario,
        metadataReserva,
      });
    } catch (saveErr) {
      if (!registradoEnN8n && saveErr.statusCode === 409) {
        return res.status(409).json({
          status: 'error',
          message: saveErr.message,
        });
      }
    }

    return res.status(200).json({
      status: 'success',
      message: '¡Muchas gracias por tu evaluación!',
      data: {
        reserva_id: String(reserva.id),
        puntaje: puntajeNum,
        comentario,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crearReserva,
  getReservas,
  getReservaById,
  getReservaRawById,
  getReservasEnMemoria,
  cancelarReserva,
  confirmarReserva,
  reprogramarReserva,
  marcarAtendida,
  marcarNoAsistio,
  cerrarCitasCumplidas,
  cerrarCitasCumplidasInternal,
  ejecutarRecordatorios24h,
  verificarWebhookWhatsApp,
  procesarWebhookWhatsApp,
  obtenerInfoEncuesta,
  registrarEncuestaSatisfaccion,
};

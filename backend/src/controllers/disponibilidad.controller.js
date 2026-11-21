const supabase = require('../database/supabaseClient');
const { MOCK_DISPONIBILIDAD, MOCK_RESERVAS, MOCK_ESTILISTAS, MOCK_SERVICIOS } = require('../database/mockData');
const { calcularDisponibilidad, obtenerFechaHoraSistema, resolverEstilistaMockId } = require('../utils/disponibilidad.utils');
const { getReservasEnMemoria } = require('./reservas.controller');
const { obtenerCatalogoCompleto } = require('./servicios.controller');
const { obtenerEquipoCompleto } = require('./estilistas.controller');
const { obtenerBloqueosAplicables } = require('../services/bloqueos.service');

function extraerHoraChile(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '00:00';
  try {
    const parts = new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const hh = (parts.find((p) => p.type === 'hour')?.value || '00').padStart(2, '0');
    const mm = (parts.find((p) => p.type === 'minute')?.value || '00').padStart(2, '0');
    return `${hh === '24' ? '00' : hh}:${mm}`;
  } catch (_) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

/**
 * Consulta los slots libres para un estilista, fecha y servicio.
 *
 * GET /api/v1/disponibilidad
 * Query params requeridos:
 *   - estilista_id  : string
 *   - fecha         : string "YYYY-MM-DD"
 *   - servicio_id   : string  (para obtener la duración automáticamente)
 *
 * Query params opcionales:
 *   - duracion_min  : number  (puede usarse directamente en vez de servicio_id)
 *   - intervalo_min : number  (granularidad de slots, default 30)
 */
const getDisponibilidad = async (req, res, next) => {
  try {
    const { estilista_id, fecha, servicio_id, duracion_min, intervalo_min } = req.query;

    // --- Validaciones ---
    if (!estilista_id || !fecha) {
      return res.status(400).json({
        status: 'error',
        message: 'Los parámetros estilista_id y fecha son obligatorios.',
      });
    }

    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
      return res.status(400).json({
        status: 'error',
        message: 'El formato de fecha debe ser YYYY-MM-DD.',
      });
    }

    // No aceptar fechas pasadas (usando fecha real del sistema en America/Santiago)
    const { fechaHoy: hoy } = obtenerFechaHoraSistema();
    if (fecha < hoy) {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede consultar disponibilidad para fechas pasadas.',
      });
    }

    if (!servicio_id && !duracion_min) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe proporcionar servicio_id o duracion_min.',
      });
    }

    const estIdStr = String(estilista_id);
    const svcIdStr = String(servicio_id);
    const estNum = isNaN(estilista_id) ? null : Number(estilista_id);
    const svcNum = isNaN(servicio_id) ? null : Number(servicio_id);

    let estilistaNombreDb = '';
    try {
      const { items: equipo } = await obtenerEquipoCompleto();
      const estEquipo = equipo.find((e) => String(e.id) === estIdStr);
      if (estEquipo) {
        estilistaNombreDb = `${estEquipo.nombre || ''} ${estEquipo.apellido || ''}`.trim();
      }
    } catch (_) { }

    if (!estilistaNombreDb && supabase) {
      try {
        const { data: estRow } = await supabase
          .from('estilistas')
          .select('nombre, apellido')
          .eq('id', estNum !== null ? estNum : estilista_id)
          .maybeSingle();
        if (estRow) {
          estilistaNombreDb = `${estRow.nombre || ''} ${estRow.apellido || ''}`.trim();
        }
      } catch (_) { }
    }

    const estMockId = resolverEstilistaMockId(estIdStr, estilistaNombreDb);

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

    // --- Resolver duración sincronizada con "Nuestra Selección" ---
    let duracion = parseInt(duracion_min, 10) || 0;

    if (!duracion && servicio_id) {
      try {
        const { items: catalogo } = await obtenerCatalogoCompleto();
        const svcCatalogo = catalogo.find(
          (s) => String(s.id) === svcIdStr || String(s.id) === svcMockId
        );
        if (svcCatalogo && Number(svcCatalogo.duracion_min) > 0) {
          duracion = Number(svcCatalogo.duracion_min);
        }
      } catch (_) { }
    }

    if (supabase && !duracion) {
      try {
        const { data: servicio, error } = await supabase
          .from('servicios')
          .select('duracion_min')
          .eq('id', svcNum !== null ? svcNum : servicio_id)
          .single();

        if (!error && servicio) {
          duracion = servicio.duracion_min;
        }
      } catch (_) { }
    }

    if (!duracion && servicio_id) {
      // Fallback Mock
      const servicioMock = MOCK_SERVICIOS.find((s) => s.id === servicio_id || s.id === svcMockId);
      if (servicioMock) {
        duracion = servicioMock.duracion_min;
      }
    }

    if (!duracion || duracion <= 0) {
      duracion = 45; // Duración base por defecto
    }

    // --- Obtener horario semanal del estilista ---
    // Priorizar el horario oficial por estilista definido en MOCK_DISPONIBILIDAD
    let horarios = MOCK_DISPONIBILIDAD.filter(
      (h) => h.estilista_id === estilista_id || h.estilista_id === estMockId
    );

    if (horarios.length === 0 && supabase) {
      try {
        const { data, error } = await supabase
          .from('disponibilidad')
          .select('dia_semana, hora_inicio, hora_fin')
          .eq('estilista_id', estNum !== null ? estNum : estilista_id);

        if (!error && Array.isArray(data) && data.length > 0) {
          horarios = data;
        }
      } catch (_) { }
    }

    // Si aún no hay horarios específicos definidos, asignar horario laboral semanal completo (Lun-Sáb 09:00 a 19:00)
    if (horarios.length === 0) {
      horarios = [1, 2, 3, 4, 5, 6].map((dia) => ({
        dia_semana: dia,
        hora_inicio: '09:00',
        hora_fin: '19:00',
      }));
    }

    // --- Obtener reservas existentes del día ---
    let reservasDelDia = [];
    let consultadoEnSupabase = false;

    if (supabase) {
      try {
        const iniDia = `${fecha}T00:00:00-03:00`;
        const finDia = `${fecha}T23:59:59-03:00`;

        const { data, error } = await supabase
          .from('reservas')
          .select('fecha_hora_inicio, fecha_hora_fin')
          .eq('estilista_id', estNum !== null ? estNum : estilista_id)
          .gte('fecha_hora_inicio', iniDia)
          .lte('fecha_hora_inicio', finDia)
          .in('estado', ['pendiente', 'confirmada']);

        if (!error && Array.isArray(data)) {
          consultadoEnSupabase = true;
          reservasDelDia = data.map((r) => ({
            hora_inicio: extraerHoraChile(r.fecha_hora_inicio),
            hora_fin: extraerHoraChile(r.fecha_hora_fin),
          }));
        }
      } catch (_) { }
    }

    if (!consultadoEnSupabase) {
      const listaMemoria = getReservasEnMemoria() || MOCK_RESERVAS;
      reservasDelDia = listaMemoria.filter(
        (r) =>
          (String(r.estilista_id) === String(estilista_id) || String(r.estilista_id) === String(estMockId)) &&
          r.fecha === fecha &&
          ['pendiente', 'confirmada'].includes(r.estado)
      );
    }

    // --- Obtener bloqueos administrativos activos para estilista y fecha ---
    const bloqueosDelDia = await obtenerBloqueosAplicables({
      estilista_id: estMockId,
      estilista_nombre: estilistaNombreDb,
      fecha,
    });

    // --- Calcular disponibilidad según el tiempo real del servicio ---
    const intervalo = parseInt(intervalo_min, 10) || duracion;
      const {
        slots,
        trabajaEseDia,
        bloqueadoDiaCompleto,
        motivoBloqueo,
      } = calcularDisponibilidad({
        fecha,
        duracionMin: duracion,
        horarios,
        reservas: reservasDelDia,
        bloqueos: bloqueosDelDia,
        intervalMin: intervalo,
      });

      return res.status(200).json({
        status: 'success',
        source: supabase ? 'supabase' : 'mock',
        data: {
          estilista_id,
          fecha,
          duracion_min: duracion,
          trabaja_ese_dia: trabajaEseDia,
          bloqueado_dia_completo: bloqueadoDiaCompleto,
          motivo_bloqueo: motivoBloqueo,
          slots_disponibles: slots,
          total_slots: slots.length,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Consulta disponibilidad para TODOS los estilistas en una fecha dada.
   * Útil para mostrar al cliente qué profesional tiene cuándo libre.
   *
   * GET /api/v1/disponibilidad/todos
   * Query params requeridos:
   *   - fecha        : string "YYYY-MM-DD"
   *   - servicio_id  : string
   */
  const getDisponibilidadTodos = async (req, res, next) => {
    try {
      const { fecha, servicio_id } = req.query;

      if (!fecha || !servicio_id) {
        return res.status(400).json({
          status: 'error',
          message: 'Los parámetros fecha y servicio_id son obligatorios.',
        });
      }

      const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!fechaRegex.test(fecha)) {
        return res.status(400).json({
          status: 'error',
          message: 'El formato de fecha debe ser YYYY-MM-DD.',
        });
      }

      const { fechaHoy: hoy } = obtenerFechaHoraSistema();
      if (fecha < hoy) {
        return res.status(400).json({
          status: 'error',
          message: 'No se puede consultar disponibilidad para fechas pasadas.',
        });
      }

      // Resolver duración del servicio desde catálogo ("Nuestra Selección"), mock o supabase
      let duracion = 0;
      try {
        const { items: catalogo } = await obtenerCatalogoCompleto();
        const svcCatalogo = catalogo.find((s) => String(s.id) === String(servicio_id));
        if (svcCatalogo && Number(svcCatalogo.duracion_min) > 0) {
          duracion = Number(svcCatalogo.duracion_min);
        }
      } catch (_) { }

      if (!duracion) {
        const servicioMock = MOCK_SERVICIOS.find((s) => s.id === servicio_id);
        if (servicioMock) {
          duracion = servicioMock.duracion_min;
        }
      }

      if (!duracion) {
        return res.status(404).json({
          status: 'error',
          message: `Servicio '${servicio_id}' no encontrado.`,
        });
      }

      // Obtener estilistas que realizan ese servicio (mock)
      const estilistaIds = MOCK_ESTILISTAS
        .filter((e) => e.activo && e.servicios_ids.includes(servicio_id))
        .map((e) => e.id);

      const listaMemoria = getReservasEnMemoria() || MOCK_RESERVAS;
        const resultados = await Promise.all(
          estilistaIds.map(async (estilista_id) => {
            const horarios = MOCK_DISPONIBILIDAD.filter((h) => h.estilista_id === estilista_id);
            const reservas = listaMemoria.filter(
              (r) =>
                r.estilista_id === estilista_id &&
                r.fecha === fecha &&
                ['pendiente', 'confirmada'].includes(r.estado)
            );
            const bloqueos = await obtenerBloqueosAplicables({ estilista_id, fecha });

            const estilista = MOCK_ESTILISTAS.find((e) => e.id === estilista_id);
            const {
              slots,
              trabajaEseDia,
              bloqueadoDiaCompleto,
              motivoBloqueo,
            } = calcularDisponibilidad({
              fecha,
              duracionMin: duracion,
              horarios,
              reservas,
              bloqueos,
              intervalMin: duracion,
            });

        return {
          estilista_id,
          nombre_completo: `${estilista.nombre} ${estilista.apellido}`,
          especialidad: estilista.especialidad,
          nivel: estilista.nivel,
          trabaja_ese_dia: trabajaEseDia,
          bloqueado_dia_completo: bloqueadoDiaCompleto,
          motivo_bloqueo: motivoBloqueo,
          slots_disponibles: slots,
          total_slots: slots.length,
        };
      })
    );

return res.status(200).json({
  status: 'success',
  source: 'mock',
  data: {
    fecha,
    servicio_id,
    duracion_min: duracion,
    estilistas: resultados,
  },
});
  } catch (err) {
  next(err);
}
};

module.exports = {
  getDisponibilidad,
  getDisponibilidadTodos,
};

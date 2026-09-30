const supabase = require('../database/supabaseClient');
const { MOCK_DISPONIBILIDAD, MOCK_RESERVAS, MOCK_ESTILISTAS, MOCK_SERVICIOS } = require('../database/mockData');
const { calcularDisponibilidad } = require('../utils/disponibilidad.utils');

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

    // No aceptar fechas pasadas
    const hoy = new Date().toISOString().split('T')[0];
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

    // --- Resolver duración ---
    let duracion = parseInt(duracion_min, 10) || 0;

    if (supabase && !duracion) {
      // Intentar desde Supabase
      const { data: servicio, error } = await supabase
        .from('servicios')
        .select('duracion_min')
        .eq('id', servicio_id)
        .single();

      if (!error && servicio) {
        duracion = servicio.duracion_min;
      }
    }

    if (!duracion && servicio_id) {
      // Fallback Mock
      const servicioMock = MOCK_SERVICIOS.find((s) => s.id === servicio_id);
      if (!servicioMock) {
        return res.status(404).json({
          status: 'error',
          message: `Servicio '${servicio_id}' no encontrado.`,
        });
      }
      duracion = servicioMock.duracion_min;
    }

    if (!duracion || duracion <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No se pudo resolver una duración válida para el servicio.',
      });
    }

    // --- Obtener horario semanal del estilista ---
    let horarios = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('disponibilidad')
        .select('dia_semana, hora_inicio, hora_fin')
        .eq('estilista_id', estilista_id);

      if (!error && data && data.length > 0) {
        horarios = data;
      }
    }

    if (horarios.length === 0) {
      // Fallback mock: verificar que el estilista existe
      const estilista = MOCK_ESTILISTAS.find((e) => e.id === estilista_id);
      if (!estilista) {
        return res.status(404).json({
          status: 'error',
          message: `Estilista '${estilista_id}' no encontrado.`,
        });
      }
      horarios = MOCK_DISPONIBILIDAD.filter((h) => h.estilista_id === estilista_id);
    }

    // --- Obtener reservas existentes del día ---
    let reservasDelDia = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('reservas')
        .select('hora_inicio, hora_fin')
        .eq('estilista_id', estilista_id)
        .eq('fecha', fecha)
        .in('estado', ['pendiente', 'confirmada']);

      if (!error && data) {
        reservasDelDia = data;
      }
    } else {
      // Fallback mock
      reservasDelDia = MOCK_RESERVAS.filter(
        (r) =>
          r.estilista_id === estilista_id &&
          r.fecha === fecha &&
          ['pendiente', 'confirmada'].includes(r.estado)
      );
    }

    // --- Calcular disponibilidad ---
    const intervalo = parseInt(intervalo_min, 10) || 30;
    const { slots, trabajaEseDia } = calcularDisponibilidad({
      fecha,
      duracionMin: duracion,
      horarios,
      reservas: reservasDelDia,
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

    const hoy = new Date().toISOString().split('T')[0];
    if (fecha < hoy) {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede consultar disponibilidad para fechas pasadas.',
      });
    }

    // Resolver duración del servicio desde mock/supabase
    let duracion = 0;
    const servicioMock = MOCK_SERVICIOS.find((s) => s.id === servicio_id);
    if (servicioMock) {
      duracion = servicioMock.duracion_min;
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

    const resultados = estilistaIds.map((estilista_id) => {
      const horarios = MOCK_DISPONIBILIDAD.filter((h) => h.estilista_id === estilista_id);
      const reservas = MOCK_RESERVAS.filter(
        (r) =>
          r.estilista_id === estilista_id &&
          r.fecha === fecha &&
          ['pendiente', 'confirmada'].includes(r.estado)
      );

      const estilista = MOCK_ESTILISTAS.find((e) => e.id === estilista_id);
      const { slots, trabajaEseDia } = calcularDisponibilidad({
        fecha,
        duracionMin: duracion,
        horarios,
        reservas,
      });

      return {
        estilista_id,
        nombre_completo: `${estilista.nombre} ${estilista.apellido}`,
        especialidad: estilista.especialidad,
        nivel: estilista.nivel,
        trabaja_ese_dia: trabajaEseDia,
        slots_disponibles: slots,
        total_slots: slots.length,
      };
    });

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

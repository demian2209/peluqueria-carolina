const { MOCK_SERVICIOS } = require('../database/mockData');
const supabase = require('../database/supabaseClient');

/**
 * Obtener la lista completa de servicios
 * GET /api/v1/servicios
 */
const getServicios = async (req, res, next) => {
  try {
    const { categoria } = req.query;

    if (supabase) {
      let query = supabase.from('servicios').select('*').eq('activo', true);

      if (categoria) {
        query = query.eq('categoria', categoria);
      }

      const { data, error } = await query;

      if (!error && data) {
        return res.status(200).json({
          status: 'success',
          count: data.length,
          data,
        });
      }
    }

    // Fallback a datos mock
    let servicios = MOCK_SERVICIOS.filter((s) => s.activo);
    if (categoria) {
      servicios = servicios.filter((s) => s.categoria.toLowerCase() === categoria.toLowerCase());
    }

    return res.status(200).json({
      status: 'success',
      source: 'mock',
      count: servicios.length,
      data: servicios,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener detalle de un servicio por ID
 * GET /api/v1/servicios/:id
 */
const getServicioById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (supabase) {
      const { data, error } = await supabase
        .from('servicios')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        return res.status(200).json({
          status: 'success',
          data,
        });
      }
    }

    // Fallback Mock
    const servicio = MOCK_SERVICIOS.find((s) => s.id === id);
    if (!servicio) {
      return res.status(404).json({
        status: 'error',
        message: `Servicio con ID '${id}' no encontrado`,
      });
    }

    return res.status(200).json({
      status: 'success',
      source: 'mock',
      data: servicio,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getServicios,
  getServicioById,
};

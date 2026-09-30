const { MOCK_ESTILISTAS, MOCK_SERVICIOS } = require('../database/mockData');
const supabase = require('../database/supabaseClient');

/**
 * Obtener la lista completa de estilistas
 * GET /api/v1/estilistas
 */
const getEstilistas = async (req, res, next) => {
  try {
    const { nivel } = req.query;

    if (supabase) {
      let query = supabase.from('estilistas').select('*').eq('activo', true);

      if (nivel) {
        query = query.eq('nivel', nivel);
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
    let estilistas = MOCK_ESTILISTAS.filter((e) => e.activo);
    if (nivel) {
      estilistas = estilistas.filter((e) => e.nivel.toLowerCase() === nivel.toLowerCase());
    }

    return res.status(200).json({
      status: 'success',
      source: 'mock',
      count: estilistas.length,
      data: estilistas,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener un estilista por ID
 * GET /api/v1/estilistas/:id
 */
const getEstilistaById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (supabase) {
      const { data, error } = await supabase
        .from('estilistas')
        .select('*, disponibilidad(*)')
        .eq('id', id)
        .single();

      if (!error && data) {
        return res.status(200).json({
          status: 'success',
          data,
        });
      }
    }

    const estilista = MOCK_ESTILISTAS.find((e) => e.id === id);
    if (!estilista) {
      return res.status(404).json({
        status: 'error',
        message: `Estilista con ID '${id}' no encontrado`,
      });
    }

    return res.status(200).json({
      status: 'success',
      source: 'mock',
      data: estilista,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener los servicios habilitados para un estilista específico
 * GET /api/v1/estilistas/:id/servicios
 */
const getServiciosPorEstilista = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (supabase) {
      const { data, error } = await supabase
        .from('estilista_servicios')
        .select('servicios(*)')
        .eq('estilista_id', id);

      if (!error && data) {
        const servicios = data.map((item) => item.servicios);
        return res.status(200).json({
          status: 'success',
          count: servicios.length,
          data: servicios,
        });
      }
    }

    const estilista = MOCK_ESTILISTAS.find((e) => e.id === id);
    if (!estilista) {
      return res.status(404).json({
        status: 'error',
        message: `Estilista con ID '${id}' no encontrado`,
      });
    }

    const servicios = MOCK_SERVICIOS.filter((s) =>
      estilista.servicios_ids.includes(s.id)
    );

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

module.exports = {
  getEstilistas,
  getEstilistaById,
  getServiciosPorEstilista,
};

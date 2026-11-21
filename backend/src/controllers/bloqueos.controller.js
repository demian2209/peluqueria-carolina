const {
  listarBloqueos,
  obtenerBloqueosAplicables,
  crearBloqueo,
  actualizarBloqueo,
  eliminarBloqueo,
} = require('../services/bloqueos.service');

/**
 * GET /api/v1/bloqueos/publico
 * Devuelve únicamente bloqueos activos (opcionalmente filtrados por estilista_id y fecha)
 * para que el formulario público de reservas muestre motivos y refleje bloqueos al instante.
 */
const getBloqueosPublicos = async (req, res, next) => {
  try {
    const { estilista_id, fecha } = req.query;

    if (fecha) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
        return res.status(400).json({
          status: 'error',
          message: 'El formato de fecha debe ser YYYY-MM-DD.',
        });
      }
      const aplicables = await obtenerBloqueosAplicables({ estilista_id, fecha });
      return res.status(200).json({
        status: 'success',
        count: aplicables.length,
        data: aplicables,
      });
    }

    const { items, source } = await listarBloqueos({
      estilista_id,
      activo: true,
    });

    return res.status(200).json({
      status: 'success',
      source,
      count: items.length,
      data: items,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/bloqueos (Admin)
 * Lista todos los bloqueos (activos e inactivos) con filtros opcionales.
 */
const getBloqueosAdmin = async (req, res, next) => {
  try {
    const { estilista_id, tipo, activo } = req.query;
    const { items, source } = await listarBloqueos({ estilista_id, tipo, activo });

    return res.status(200).json({
      status: 'success',
      source,
      count: items.length,
      data: items,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/bloqueos (Admin)
 */
const postBloqueo = async (req, res, next) => {
  try {
    const { data, source } = await crearBloqueo(req.body);
    return res.status(201).json({
      status: 'success',
      source,
      data,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        status: 'error',
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * PATCH /api/v1/bloqueos/:id (Admin)
 */
const patchBloqueo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, source } = await actualizarBloqueo(id, req.body);
    return res.status(200).json({
      status: 'success',
      source,
      data,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        status: 'error',
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * DELETE /api/v1/bloqueos/:id (Admin)
 */
const deleteBloqueo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await eliminarBloqueo(id);
    return res.status(200).json({
      status: 'success',
      source: result.source,
      data: { id: result.id },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        status: 'error',
        message: err.message,
      });
    }
    next(err);
  }
};

module.exports = {
  getBloqueosPublicos,
  getBloqueosAdmin,
  postBloqueo,
  patchBloqueo,
  deleteBloqueo,
};

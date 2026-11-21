const {
  listarEncuestas,
  obtenerEncuestaPorReservaId,
  eliminarEncuesta,
} = require('../services/encuestas.service');
const { getReservasEnMemoria } = require('./reservas.controller');

/**
 * GET /api/v1/encuestas
 * Lista todas las respuestas a las encuestas de satisfacción enriquecidas con datos
 * de la reserva, cliente, estilista y servicio, además de KPIs agregados.
 * Protegido: requireAuth + requireAdmin
 */
const getEncuestas = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const {
      puntaje,
      estilista_id,
      servicio_id,
      fecha_desde,
      fecha_hasta,
      solo_comentarios,
      busqueda,
      q,
    } = req.query;

    const reservasMemoria =
      typeof getReservasEnMemoria === 'function' ? getReservasEnMemoria() : [];

    const resultado = await listarEncuestas(
      {
        puntaje,
        estilista_id,
        servicio_id,
        fecha_desde,
        fecha_hasta,
        solo_comentarios,
        busqueda: busqueda || q || '',
      },
      reservasMemoria
    );

    return res.status(200).json({
      status: 'success',
      source: resultado.source,
      count: resultado.items.length,
      stats: resultado.stats,
      filtered_stats: resultado.filtered_stats,
      data: resultado.items,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/encuestas/:id
 * Obtiene el detalle enriquecido de una encuesta por su ID o reserva_id.
 * Protegido: requireAuth + requireAdmin
 */
const getEncuestaById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reservasMemoria =
      typeof getReservasEnMemoria === 'function' ? getReservasEnMemoria() : [];
    const { items, source } = await listarEncuestas({}, reservasMemoria);

    const found = items.find(
      (item) =>
        String(item.id) === String(id) ||
        String(item.reserva_id) === String(id) ||
        String(item.codigo_reserva).toUpperCase() === String(id).toUpperCase()
    );

    if (!found) {
      return res.status(404).json({
        status: 'error',
        message: `Encuesta '${id}' no encontrada.`,
      });
    }

    return res.status(200).json({
      status: 'success',
      source,
      data: found,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/encuestas/:id
 * Elimina un registro de encuesta (uso administrativo).
 * Protegido: requireAuth + requireAdmin
 */
const deleteEncuesta = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await eliminarEncuesta(id);
    return res.status(200).json({
      status: 'success',
      source: deleted.source,
      message: 'Encuesta eliminada correctamente.',
      data: { id: deleted.id },
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
  getEncuestas,
  getEncuestaById,
  deleteEncuesta,
  obtenerEncuestaPorReservaId,
};

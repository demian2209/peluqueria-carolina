const { obtenerResumenKpis } = require('../services/kpis.service');

/**
 * GET /api/v1/kpis/resumen
 * Query opcional: fecha_desde (YYYY-MM-DD), fecha_hasta (YYYY-MM-DD)
 * Protegido: requireAuth + requireAdmin
 */
const getResumenKpis = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const { fecha_desde, fecha_hasta } = req.query;

    const resultado = await obtenerResumenKpis({ fecha_desde, fecha_hasta });

    return res.status(200).json({
      status: 'success',
      source: resultado.source,
      ...(resultado.warning ? { warning: resultado.warning } : {}),
      data: {
        periodo: resultado.periodo,
        confirmaciones: resultado.confirmaciones,
        inasistencias: resultado.inasistencias,
        chatbot: resultado.chatbot,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getResumenKpis,
};

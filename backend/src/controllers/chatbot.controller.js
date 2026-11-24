const {
  CATEGORIAS_CATALOGO_META,
  listarConversacionesChatbot,
  obtenerConversacionConMensajes,
} = require('../services/chatbot.service');

/**
 * GET /api/v1/chatbot/conversaciones
 * Lista las conversaciones del chatbot con filtros multicategoría (AND/OR),
 * franja horaria (fuera de horario laboral), rango de fechas y búsqueda de texto.
 * Protegido: requireAuth + requireAdmin
 */
const getConversaciones = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const {
      categorias,
      modo_categorias,
      fuera_horario,
      fecha_desde,
      fecha_hasta,
      busqueda,
      q,
      limit,
    } = req.query;

    const resultado = await listarConversacionesChatbot({
      categorias,
      modo_categorias,
      fuera_horario,
      fecha_desde,
      fecha_hasta,
      busqueda: busqueda || q || '',
      limit,
    });

    return res.status(200).json({
      status: 'success',
      source: resultado.source,
      count: resultado.items.length,
      stats: resultado.stats,
      categorias_catalogo: CATEGORIAS_CATALOGO_META,
      ...(resultado.warning ? { warning: resultado.warning } : {}),
      data: resultado.items,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/chatbot/conversaciones/:id
 * Retorna el detalle completo de una conversación con todos sus mensajes ordenados cronológicamente.
 * Protegido: requireAuth + requireAdmin
 */
const getConversacionById = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const { id } = req.params;
    const conversacion = await obtenerConversacionConMensajes(id);

    if (!conversacion) {
      return res.status(404).json({
        status: 'error',
        message: `Conversación '${id}' no encontrada.`,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: conversacion,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/chatbot/categorias
 * Retorna el catálogo oficial de categorías para poblar filtros de la UI.
 * Protegido: requireAuth + requireAdmin
 */
const getCategoriasCatalogo = (_req, res) => {
  return res.status(200).json({
    status: 'success',
    data: CATEGORIAS_CATALOGO_META,
  });
};

module.exports = {
  getConversaciones,
  getConversacionById,
  getCategoriasCatalogo,
};

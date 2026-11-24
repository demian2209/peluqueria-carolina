const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const {
  getConversaciones,
  getConversacionById,
  getCategoriasCatalogo,
} = require('../controllers/chatbot.controller');

// Todas las rutas del historial del chatbot son exclusivas del Panel de Administración
router.get('/categorias', requireAuth, requireAdmin, getCategoriasCatalogo);
router.get('/conversaciones', requireAuth, requireAdmin, getConversaciones);
router.get('/conversaciones/:id', requireAuth, requireAdmin, getConversacionById);

module.exports = router;

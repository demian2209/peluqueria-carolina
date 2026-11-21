const express = require('express');
const router = express.Router();
const {
  getEncuestas,
  getEncuestaById,
  deleteEncuesta,
} = require('../controllers/encuestas.controller');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

// Todas las rutas del módulo administrativo de encuestas requieren sesión de Administrador
router.use(requireAuth, requireAdmin);

router.get('/', getEncuestas);
router.get('/:id', getEncuestaById);
router.delete('/:id', deleteEncuesta);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getBloqueosPublicos,
  getBloqueosAdmin,
  postBloqueo,
  patchBloqueo,
  deleteBloqueo,
} = require('../controllers/bloqueos.controller');
const {
  validarCrearBloqueo,
  validarActualizarBloqueo,
} = require('../middlewares/validarBloqueo');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

// Consulta pública de bloqueos activos para el formulario de reservas
router.get('/publico', getBloqueosPublicos);

// Administración de bloqueos horarios (requiere autenticación + rol admin)
router.get('/', requireAuth, requireAdmin, getBloqueosAdmin);
router.post('/', requireAuth, requireAdmin, validarCrearBloqueo, postBloqueo);
router.patch('/:id', requireAuth, requireAdmin, validarActualizarBloqueo, patchBloqueo);
router.delete('/:id', requireAuth, requireAdmin, deleteBloqueo);

module.exports = router;

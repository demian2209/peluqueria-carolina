const express = require('express');
const router = express.Router();
const {
  getEstilistas,
  getEstilistaById,
  getServiciosPorEstilista,
  crearEstilista,
  actualizarEstilista,
  toggleVisibilidadEstilista,
  eliminarEstilista,
  subirImagenEstilista,
} = require('../controllers/estilistas.controller');
const {
  validarCrearEstilista,
  validarActualizarEstilista,
} = require('../middlewares/validarEstilista');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

// Consulta pública (o completa con token admin ?incluir_inactivos=true)
router.get('/', getEstilistas);
router.get('/:id', getEstilistaById);
router.get('/:id/servicios', getServiciosPorEstilista);

// Carga de imagen para miembros del equipo (solo Admin)
router.post('/upload-imagen', requireAuth, requireAdmin, subirImagenEstilista);

// Operaciones CRUD de administración (solo Admin)
router.post('/', requireAuth, requireAdmin, validarCrearEstilista, crearEstilista);
router.put('/:id', requireAuth, requireAdmin, validarCrearEstilista, actualizarEstilista);
router.patch('/:id', requireAuth, requireAdmin, validarActualizarEstilista, actualizarEstilista);
router.patch('/:id/visibilidad', requireAuth, requireAdmin, toggleVisibilidadEstilista);
router.delete('/:id', requireAuth, requireAdmin, eliminarEstilista);

module.exports = router;

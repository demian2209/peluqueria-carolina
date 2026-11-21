const express = require('express');
const router = express.Router();
const {
  getServiciosSeleccion,
  getServicios,
  getServicioById,
  crearServicio,
  actualizarServicio,
  toggleVisibilidadServicio,
  eliminarServicio,
  subirImagenServicio,
} = require('../controllers/servicios.controller');
const {
  validarCrearServicio,
  validarActualizarServicio,
} = require('../middlewares/validarServicio');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

// Endpoint público optimizado para la sección "Nuestra Selección" en la landing page
router.get('/seleccion', getServiciosSeleccion);

// Consulta general y detalle de servicios
router.get('/', getServicios);
router.get('/:id', getServicioById);

// Carga de imagen para el catálogo de servicios (solo Admin)
router.post('/upload-imagen', requireAuth, requireAdmin, subirImagenServicio);

// Operaciones CRUD de administración (solo Admin)
router.post('/', requireAuth, requireAdmin, validarCrearServicio, crearServicio);
router.put('/:id', requireAuth, requireAdmin, validarCrearServicio, actualizarServicio);
router.patch('/:id', requireAuth, requireAdmin, validarActualizarServicio, actualizarServicio);
router.patch('/:id/visibilidad', requireAuth, requireAdmin, toggleVisibilidadServicio);
router.delete('/:id', requireAuth, requireAdmin, eliminarServicio);

module.exports = router;

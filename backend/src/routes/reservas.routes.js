const express = require('express');
const router = express.Router();
const {
  crearReserva,
  getReservas,
  getReservaById,
  cancelarReserva,
  confirmarReserva,
} = require('../controllers/reservas.controller');
const { validarReserva } = require('../middlewares/validarReserva');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

// CRUD principal
router.get('/', getReservas);
router.get('/:id', getReservaById);
router.post('/', validarReserva, crearReserva);

// Transiciones de estado
router.patch('/:id/cancelar', cancelarReserva);
router.patch('/:id/confirmar', requireAuth, requireAdmin, confirmarReserva);

module.exports = router;

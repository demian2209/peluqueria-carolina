const express = require('express');
const router = express.Router();
const {
  getDisponibilidad,
  getDisponibilidadTodos,
} = require('../controllers/disponibilidad.controller');

// GET /api/v1/disponibilidad?estilista_id=...&fecha=...&servicio_id=...
router.get('/', getDisponibilidad);

// GET /api/v1/disponibilidad/todos?fecha=...&servicio_id=...
router.get('/todos', getDisponibilidadTodos);

module.exports = router;

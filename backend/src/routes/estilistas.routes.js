const express = require('express');
const router = express.Router();
const {
  getEstilistas,
  getEstilistaById,
  getServiciosPorEstilista,
} = require('../controllers/estilistas.controller');

router.get('/', getEstilistas);
router.get('/:id', getEstilistaById);
router.get('/:id/servicios', getServiciosPorEstilista);

module.exports = router;

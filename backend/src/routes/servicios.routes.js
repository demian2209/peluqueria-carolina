const express = require('express');
const router = express.Router();
const { getServicios, getServicioById } = require('../controllers/servicios.controller');

router.get('/', getServicios);
router.get('/:id', getServicioById);

module.exports = router;

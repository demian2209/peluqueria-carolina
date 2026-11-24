const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const { getResumenKpis } = require('../controllers/kpis.controller');

// Módulo de KPIs exclusivo para administradores
router.get('/resumen', requireAuth, requireAdmin, getResumenKpis);

module.exports = router;

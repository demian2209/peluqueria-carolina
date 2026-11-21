const express = require('express');
const router = express.Router();
const {
  consultarAsistente,
  asistenteRateLimiter,
} = require('../controllers/asistente.controller');

/**
 * @route   POST /api/v1/asistente/consulta
 * @desc    Enviar mensaje de consulta al Asistente IA (enrutado hacia PC06 y Gemini PC07)
 * @access  Public (protegido por rate limiter)
 */
router.post('/consulta', asistenteRateLimiter, consultarAsistente);

module.exports = router;

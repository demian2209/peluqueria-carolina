const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  crearReserva,
  getReservas,
  getReservaById,
  cancelarReserva,
  confirmarReserva,
  reprogramarReserva,
  marcarAtendida,
  cerrarCitasCumplidas,
  ejecutarRecordatorios24h,
  verificarWebhookWhatsApp,
  procesarWebhookWhatsApp,
  obtenerInfoEncuesta,
  registrarEncuestaSatisfaccion,
} = require('../controllers/reservas.controller');
const { validarReserva } = require('../middlewares/validarReserva');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const { requireReservaAccess, requireInternalOrAdmin } = require('../middlewares/requireReservaAccess');

// Rate limiters contra abuso de reservas, agotamiento de cuota WhatsApp/Gmail y enumeración
const crearReservaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Has realizado demasiadas solicitudes de reserva en poco tiempo. Intenta nuevamente en unos minutos.',
  },
});

const gestionReservaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Demasiados intentos de consulta o gestión de reserva. Espera unos minutos antes de reintentar.',
  },
});

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Límite de solicitudes al webhook alcanzado.',
  },
});

// Webhook bidireccional para los 2 botones interactivos de WhatsApp (Cancelar / Reprogramar)
router.get('/whatsapp-webhook', webhookLimiter, verificarWebhookWhatsApp);
router.post('/whatsapp-webhook', webhookLimiter, procesarWebhookWhatsApp);

// Encuesta de satisfacción pública asociada a la reserva
router.get('/:id/encuesta', gestionReservaLimiter, obtenerInfoEncuesta);
router.post('/:id/encuesta', gestionReservaLimiter, registrarEncuestaSatisfaccion);

// CRUD principal
router.get('/', requireAuth, requireAdmin, getReservas);
router.get('/:id', gestionReservaLimiter, requireReservaAccess, getReservaById);
router.post('/', crearReservaLimiter, validarReserva, crearReserva);

// Transiciones de estado
router.patch('/:id/cancelar', gestionReservaLimiter, requireReservaAccess, cancelarReserva);
router.patch('/:id/confirmar', requireAuth, requireAdmin, confirmarReserva);
router.patch('/:id/reprogramar', gestionReservaLimiter, requireReservaAccess, reprogramarReserva);
router.patch('/:id/atendida', requireInternalOrAdmin, marcarAtendida);

// Tareas automatizadas y barridos programados (Pilar C y D)
router.post('/cron/cerrar-atendidas', requireInternalOrAdmin, cerrarCitasCumplidas);
router.post('/cron/recordatorios-24h', requireInternalOrAdmin, ejecutarRecordatorios24h);

module.exports = router;

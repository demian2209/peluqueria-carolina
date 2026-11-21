const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, logout, getMe } = require('../controllers/auth.controller');
const requireAuth = require('../middlewares/requireAuth');

// Protección contra fuerza bruta en login administrativo (máx. 10 intentos cada 15 min por IP)
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Demasiados intentos de inicio de sesión. Por favor intenta nuevamente en 15 minutos.',
  },
});

// POST /api/v1/auth/login  → Iniciar sesión
router.post('/login', loginRateLimiter, login);

// GET /api/v1/auth/login   → Método no permitido con guía de uso
router.get('/login', (req, res) => {
  res.status(405).json({
    status: 'error',
    message: 'El endpoint de login de la API requiere el método POST. Para acceder a la interfaz web del Panel de Administración, abre en tu navegador: http://localhost:3000/admin',
  });
});

// POST /api/v1/auth/logout → Cerrar sesión (requiere auth para invalidar el token)
router.post('/logout', requireAuth, logout);

// GET  /api/v1/auth/me     → Datos del usuario activo (requiere auth)
router.get('/me', requireAuth, getMe);

module.exports = router;

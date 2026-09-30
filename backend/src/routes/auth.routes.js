const express = require('express');
const router = express.Router();
const { login, logout, getMe } = require('../controllers/auth.controller');
const requireAuth = require('../middlewares/requireAuth');

// POST /api/v1/auth/login  → Iniciar sesión
router.post('/login', login);

// POST /api/v1/auth/logout → Cerrar sesión (requiere auth para invalidar el token)
router.post('/logout', requireAuth, logout);

// GET  /api/v1/auth/me     → Datos del usuario activo (requiere auth)
router.get('/me', requireAuth, getMe);

module.exports = router;

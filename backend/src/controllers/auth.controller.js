const crypto = require('crypto');
const supabase = require('../database/supabaseClient');
const { generarTokenAdmin, revocarTokenAdmin } = require('../utils/reservaToken.utils');

/**
 * Comparación en tiempo constante para evitar ataques de temporización (timing attacks).
 */
function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length;
}

/**
 * POST /api/v1/auth/login
 *
 * Inicia sesión con email y contraseña.
 * Soporta Supabase Auth y credenciales administrativas de entorno (ADMIN_EMAIL / ADMIN_MOCK_PASSWORD)
 * sin contraseñas por defecto hardcodeadas en el código fuente.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Email y contraseña son requeridos.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_MOCK_PASSWORD || '';
    const isProduction = process.env.NODE_ENV === 'production';

    // 1. Verificar credenciales administrativas de entorno (solo si están explícitamente configuradas
    //    y, en producción, si la contraseña no es el valor débil de ejemplo 'admin123')
    const allowEnvAdmin =
      Boolean(adminEmail && adminPassword) &&
      (!isProduction || (adminPassword !== 'admin123' && adminPassword.length >= 10));

    if (
      allowEnvAdmin &&
      timingSafeEqualStr(cleanEmail, adminEmail) &&
      timingSafeEqualStr(password, adminPassword)
    ) {
      const ttlSeconds = 8 * 60 * 60;
      return res.status(200).json({
        status: 'success',
        source: 'env_admin',
        data: {
          access_token: generarTokenAdmin(cleanEmail, ttlSeconds),
          expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
          user: {
            id: 'admin-local-id',
            email: cleanEmail,
            user_metadata: { is_admin: true },
          },
        },
      });
    }

    // 2. Modo sin Supabase: rechazar si no coincidió con las credenciales de entorno
    if (!supabase) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales incorrectas.',
      });
    }

    // 3. Fallback a Supabase Auth si estuviera configurado un usuario allí
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    if (error || !data.session) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales incorrectas.',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        access_token: data.session.access_token,
        expires_at: data.session.expires_at,
        user: {
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/logout
 *
 * Cierra la sesión activa. Requiere el Bearer token en el header.
 * En modo mock, siempre responde con éxito.
 */
const logout = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      revocarTokenAdmin(token);
    }

    if (!supabase) {
      return res.status(200).json({
        status: 'success',
        source: 'mock',
        message: 'Sesión cerrada.',
      });
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Error al cerrar sesión.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Sesión cerrada correctamente.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/auth/me
 *
 * Retorna los datos del usuario autenticado actualmente.
 * Requiere el middleware requireAuth antes de este controlador.
 */
const getMe = (req, res) => {
  const { id, email, user_metadata } = req.user;

  return res.status(200).json({
    status: 'success',
    data: {
      id,
      email,
      is_admin:
        user_metadata?.is_admin === true ||
        email === process.env.ADMIN_EMAIL,
      user_metadata,
    },
  });
};

module.exports = { login, logout, getMe };

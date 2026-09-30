const supabase = require('../database/supabaseClient');

/**
 * POST /api/v1/auth/login
 *
 * Inicia sesión con email y contraseña usando Supabase Auth.
 * Retorna el access_token y los datos del usuario.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email y contraseña son requeridos.',
      });
    }

    // Modo mock: simular login exitoso sin Supabase real
    if (!supabase) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@dev.local';
      const adminPassword = process.env.ADMIN_MOCK_PASSWORD || 'admin123';

      if (email !== adminEmail || password !== adminPassword) {
        return res.status(401).json({
          status: 'error',
          message: 'Credenciales incorrectas.',
        });
      }

      return res.status(200).json({
        status: 'success',
        source: 'mock',
        data: {
          access_token: 'mock-token-dev',
          user: {
            id: 'mock-admin-id',
            email: adminEmail,
            user_metadata: { is_admin: true },
          },
        },
      });
    }

    // Login real con Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return res.status(401).json({
        status: 'error',
        message: error?.message || 'Credenciales incorrectas.',
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

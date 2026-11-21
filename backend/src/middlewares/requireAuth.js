const supabase = require('../database/supabaseClient');
const { verificarTokenAdmin } = require('../utils/reservaToken.utils');

/**
 * Middleware: requireAuth
 *
 * Verifica que el request incluya un Bearer token válido (HMAC administrativo o Supabase Auth).
 * Si Supabase no está configurado y no se envía header, en modo mock adjunta un usuario de desarrollo.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    // 1. Verificar token administrativo firmado por HMAC (sin requerir usuarios en BD)
    const adminEmail = verificarTokenAdmin(token);
    if (adminEmail) {
      req.user = {
        id: 'admin-local-id',
        email: adminEmail,
        user_metadata: { is_admin: true },
      };
      return next();
    }

    // 2. Si Supabase está disponible, verificar contra Supabase Auth
    if (supabase) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        req.user = data.user;
        return next();
      }
    }

    return res.status(401).json({
      status: 'error',
      message: 'Token inválido o expirado.',
    });
  }

  return res.status(401).json({
    status: 'error',
    message: 'Acceso no autorizado. Se requiere token de autenticación.',
  });
};

module.exports = requireAuth;

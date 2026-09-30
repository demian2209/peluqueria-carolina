const supabase = require('../database/supabaseClient');

/**
 * Middleware: requireAuth
 *
 * Verifica que el request incluya un Bearer token válido de Supabase Auth.
 * Si Supabase no está configurado (modo mock/dev), adjunta un usuario ficticio
 * y permite continuar sin bloquear el flujo de desarrollo.
 *
 * En producción, adjunta el objeto `req.user` con los datos del usuario autenticado.
 */
const requireAuth = async (req, res, next) => {
  // Modo mock: Supabase no configurado → usuario de desarrollo simulado
  if (!supabase) {
    req.user = {
      id: 'mock-admin-id',
      email: process.env.ADMIN_EMAIL || 'admin@dev.local',
      user_metadata: { is_admin: true },
    };
    return next();
  }

  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Acceso no autorizado. Se requiere token de autenticación.',
    });
  }

  const token = authHeader.split(' ')[1];

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Token inválido o expirado.',
    });
  }

  req.user = data.user;
  next();
};

module.exports = requireAuth;

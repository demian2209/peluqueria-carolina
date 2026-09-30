/**
 * Middleware: requireAdmin
 *
 * Debe usarse DESPUÉS de requireAuth. Verifica que el usuario autenticado
 * tenga permisos de administrador, mediante dos estrategias (en orden):
 *   1. Su email coincide con ADMIN_EMAIL en las variables de entorno.
 *   2. Su metadata de Supabase incluye `is_admin: true`.
 *
 * Requiere que `req.user` ya esté adjunto por requireAuth.
 */
const requireAdmin = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      status: 'error',
      message: 'Acceso no autorizado.',
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const isAdminByEmail = adminEmail && user.email === adminEmail;
  const isAdminByMeta = user.user_metadata?.is_admin === true;

  if (!isAdminByEmail && !isAdminByMeta) {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado. Se requieren permisos de administrador.',
    });
  }

  next();
};

module.exports = requireAdmin;

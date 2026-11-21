const crypto = require('crypto');
const supabase = require('../database/supabaseClient');
const { normalizarTelefonoChileno } = require('../utils/telefono.utils');
const { verificarTokenAdmin, verificarTokenReserva } = require('../utils/reservaToken.utils');
const { getReservaRawById } = require('../controllers/reservas.controller');

/**
 * Comparación segura en tiempo constante entre dos strings.
 */
function safeEqualString(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a).trim().toLowerCase(), 'utf8');
  const bufB = Buffer.from(String(b).trim().toLowerCase(), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifica si la petición proviene de un administrador autenticado o de n8n con API Key.
 */
async function esAdminOSistema(req) {
  // 1. Verificar API Key interna (n8n / cron externo)
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (apiKey && expectedKey && safeEqualString(apiKey, expectedKey)) {
    req.authSource = 'api_key';
    return true;
  }

  // 2. Verificar Bearer Token de Administrador
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const adminEmail = verificarTokenAdmin(token);
    if (adminEmail) {
      req.user = { id: 'admin-local-id', email: adminEmail, user_metadata: { is_admin: true } };
      req.authSource = 'admin_hmac';
      return true;
    }

    if (supabase) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        const isEmailAdmin = process.env.ADMIN_EMAIL && data.user.email === process.env.ADMIN_EMAIL;
        const isMetaAdmin = data.user.user_metadata?.is_admin === true;
        if (isEmailAdmin || isMetaAdmin) {
          req.user = data.user;
          req.authSource = 'admin_supabase';
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Middleware: requireInternalOrAdmin
 * Protege rutas operativas internas (marcar atendida, barridos cron).
 * Autoriza exclusivamente a: Administrador autenticado o Sistema con x-api-key.
 */
const requireInternalOrAdmin = async (req, res, next) => {
  try {
    if (await esAdminOSistema(req)) return next();

    return res.status(401).json({
      status: 'error',
      message: 'Acceso no autorizado. Se requiere sesión de administrador o clave de sistema.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: requireReservaAccess
 * Protege la consulta individual, cancelación y reprogramación de una reserva (/reservas/:id).
 *
 * Autoriza si se cumple CUALQUIERA de:
 *   1. Administrador autenticado (Bearer token) o automatización (x-api-key).
 *   2. Cliente con token criptográfico stateless de su reserva (`token` HMAC-SHA256).
 *   3. Cliente sin cuenta que verifica titularidad enviando el `telefono` (WhatsApp)
 *      o `email` con el que agendó la cita.
 */
const requireReservaAccess = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Admin o sistema interno
    if (await esAdminOSistema(req)) return next();

    // 2. Extraer credenciales de titularidad del cliente (query, body o headers)
    const token =
      req.query?.token ||
      req.body?.token ||
      req.headers['x-reserva-token'] ||
      '';

    const contactoRaw =
      req.query?.contacto ||
      req.body?.contacto ||
      req.query?.telefono ||
      req.body?.telefono ||
      req.body?.cliente_telefono ||
      req.query?.email ||
      req.body?.email ||
      req.body?.cliente_email ||
      req.headers['x-cliente-contacto'] ||
      '';

    // 2a. Verificación por token HMAC stateless (compatible con ID o Código de Reserva)
    if (token) {
      if (verificarTokenReserva(id, String(token))) {
        const resByCode = await getReservaRawById(id);
        if (resByCode) req.params.id = String(resByCode.id);
        req.authSource = 'cliente_token';
        return next();
      }
      const reservaLookup = await getReservaRawById(id);
      if (
        reservaLookup &&
        verificarTokenReserva(reservaLookup.id, String(token), reservaLookup.codigo_reserva)
      ) {
        req.params.id = String(reservaLookup.id);
        req.reservaVerificada = reservaLookup;
        req.authSource = 'cliente_token';
        return next();
      }
    }

    // 2b. Verificación por titularidad (teléfono WhatsApp o email de la reserva)
    if (contactoRaw) {
      const reserva = await getReservaRawById(id);
      if (!reserva) {
        return res.status(404).json({
          status: 'error',
          message: `Reserva '${id}' no encontrada.`,
        });
      }

      const emailReserva = (reserva.clientes?.email || reserva.cliente_email || '').trim().toLowerCase();
      const telReserva = normalizarTelefonoChileno(
        reserva.clientes?.telefono_whatsapp || reserva.cliente_telefono || ''
      );

      const inputStr = String(contactoRaw).trim();
      const inputEmail = inputStr.toLowerCase();
      const inputTel = normalizarTelefonoChileno(inputStr);

      const coincideEmail = emailReserva && inputEmail.includes('@') && safeEqualString(emailReserva, inputEmail);
      const coincideTel = telReserva && inputTel && safeEqualString(telReserva, inputTel);

      if (coincideEmail || coincideTel) {
        req.params.id = String(reserva.id);
        req.authSource = 'cliente_titular';
        req.reservaVerificada = reserva;
        return next();
      }

      return res.status(403).json({
        status: 'error',
        message: 'El WhatsApp o correo ingresado no coincide con el titular de esta reserva.',
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'Para gestionar tu reserva debes verificar tu WhatsApp o correo electrónico con el que agendaste.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requireReservaAccess,
  requireInternalOrAdmin,
  esAdminOSistema,
  safeEqualString,
};


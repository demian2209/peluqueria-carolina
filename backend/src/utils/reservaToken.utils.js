const crypto = require('crypto');

// Registro en memoria de tokens administrativos revocados explícitamente vía logout
const revokedAdminTokens = new Map();
const DEFAULT_ADMIN_TTL_SEC = 8 * 60 * 60; // 8 horas

/**
 * Obtiene el secreto criptográfico para firmar tokens stateless (HMAC-SHA256).
 * En producción exige RESERVA_TOKEN_SECRET o SUPABASE_SERVICE_ROLE_KEY configurados.
 */
function getHmacSecret() {
  const secret =
    process.env.RESERVA_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Configuración insegura: Se requiere RESERVA_TOKEN_SECRET en producción.'
    );
  }

  return process.env.ADMIN_MOCK_PASSWORD || 'peluqueria-carolina-hmac-secret-dev-only';
}

/**
 * Genera un Código de Reserva único y legible en formato `PC-<ID>-<HASH4>` (ej. `PC-18-7F3A`).
 * Como el hash incorpora el timestamp de inicio (`fechaHoraInicio`), al reprogramar
 * la cita a una nueva fecha u hora se genera automáticamente un NUEVO código de reserva.
 *
 * Nota: El algoritmo FNV-1a de 32 bits en base36 también se replica de forma idéntica
 * dentro de los nodos de n8n para garantizar 100% de consistencia.
 *
 * @param {string|number} id
 * @param {string|Date} [fechaHoraInicio]
 * @param {string} [fecha]
 * @param {string} [horaInicio]
 * @returns {string}
 */
function generarCodigoReserva(id, fechaHoraInicio = null, fecha = null, horaInicio = null) {
  if (id === undefined || id === null) return '';
  const idStr = String(id).trim();

  let isoTarget = fechaHoraInicio;
  if (!isoTarget && fecha && horaInicio) {
    isoTarget = `${fecha}T${horaInicio}:00-03:00`;
  }

  let epochMin = 0;
  if (isoTarget) {
    const dt = isoTarget instanceof Date ? isoTarget : new Date(isoTarget);
    if (!isNaN(dt.getTime())) {
      epochMin = Math.floor(dt.getTime() / 60000);
    }
  }

  const seed = `${idStr}:${epochMin}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const suffix = (h >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  const idClean = /^\d+$/.test(idStr)
    ? idStr
    : idStr.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();

  return `PC-${idClean}-${suffix}`;
}

/**
 * Si el identificador recibido tiene formato de Código de Reserva (`PC-<ID>-<HASH>`),
 * extrae la parte correspondiente al ID o prefijo para agilizar su búsqueda.
 *
 * @param {string|number} idOrCode
 * @returns {{ raw: string, isCode: boolean, extractedId: string }}
 */
function parsearIdentificadorReserva(idOrCode) {
  const raw = String(idOrCode || '').replace(/^#/, '').trim();
  const match = /^PC-([A-Z0-9]+)-([A-Z0-9]{4})$/i.exec(raw);
  if (match) {
    return {
      raw: raw.toUpperCase(),
      isCode: true,
      extractedId: match[1],
      suffix: match[2].toUpperCase(),
    };
  }
  return {
    raw,
    isCode: false,
    extractedId: raw,
    suffix: null,
  };
}

/**
 * Genera un token HMAC-SHA256 corto (16 caracteres hex) e infalsificable
 * vinculado al ID de una reserva específica.
 *
 * @param {string|number} reservaId
 * @returns {string}
 */
function generarTokenReserva(reservaId) {
  if (reservaId === undefined || reservaId === null) return '';
  return crypto
    .createHmac('sha256', getHmacSecret())
    .update(`reserva:${String(reservaId).trim()}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Verifica en tiempo constante (timing-safe) si el token proporcionado
 * es válido para el ID o Código de Reserva indicado.
 *
 * @param {string|number} reservaId
 * @param {string} token
 * @param {string} [codigoReserva]
 * @returns {boolean}
 */
function verificarTokenReserva(reservaId, token, codigoReserva = '') {
  if (!reservaId || !token || typeof token !== 'string') return false;
  const cleanToken = token.trim().toLowerCase();

  const candidatos = [generarTokenReserva(reservaId)];
  if (codigoReserva) {
    candidatos.push(generarTokenReserva(codigoReserva));
  }

  return candidatos.some((esperado) => {
    if (!esperado) return false;
    const a = Buffer.from(esperado, 'utf8');
    const b = Buffer.from(cleanToken, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  });
}

/**
 * Genera un token administrativo firmado con HMAC-SHA256 e incluyendo expiración (TTL).
 * Formato: `carolina-admin.<emailHex>.<expEpochSec>.<sig>`
 *
 * @param {string} email
 * @param {number} [ttlSeconds=28800] - Tiempo de vida en segundos (por defecto 8 horas)
 * @returns {string}
 */
function generarTokenAdmin(email, ttlSeconds = DEFAULT_ADMIN_TTL_SEC) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Number(ttlSeconds) || DEFAULT_ADMIN_TTL_SEC);
  const sig = crypto
    .createHmac('sha256', getHmacSecret())
    .update(`admin:${cleanEmail}:${exp}`)
    .digest('hex')
    .slice(0, 32);
  const payloadHex = Buffer.from(cleanEmail, 'utf8').toString('hex');
  return `carolina-admin.${payloadHex}.${exp}.${sig}`;
}

/**
 * Revoca un token administrativo antes de su fecha de expiración (usado en /auth/logout).
 *
 * @param {string} token
 */
function revocarTokenAdmin(token) {
  if (!token || typeof token !== 'string') return;
  const nowSec = Math.floor(Date.now() / 1000);
  // Limpiar tokens ya expirados del mapa en memoria
  for (const [k, exp] of revokedAdminTokens.entries()) {
    if (exp <= nowSec) revokedAdminTokens.delete(k);
  }
  revokedAdminTokens.set(token.trim(), nowSec + DEFAULT_ADMIN_TTL_SEC);
}

/**
 * Verifica un token administrativo firmado con HMAC, comprobando integridad criptográfica,
 * vigencia temporal (exp) y que no haya sido revocado en logout.
 *
 * @param {string} token
 * @returns {string|null} Email del administrador si el token es válido, o null
 */
function verificarTokenAdmin(token) {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();
  if (!cleanToken.startsWith('carolina-admin.')) return null;

  if (revokedAdminTokens.has(cleanToken)) {
    return null;
  }

  const parts = cleanToken.split('.');
  if (parts.length !== 4) return null;

  try {
    const email = Buffer.from(parts[1], 'hex').toString('utf8').trim().toLowerCase();
    const exp = Number(parts[2]);
    const sigRecibida = parts[3];

    if (!email || !Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    const sigEsperada = crypto
      .createHmac('sha256', getHmacSecret())
      .update(`admin:${email}:${exp}`)
      .digest('hex')
      .slice(0, 32);

    const a = Buffer.from(sigEsperada, 'utf8');
    const b = Buffer.from(sigRecibida, 'utf8');
    if (a.length !== b.length) return null;
    return crypto.timingSafeEqual(a, b) ? email : null;
  } catch {
    return null;
  }
}

module.exports = {
  generarCodigoReserva,
  parsearIdentificadorReserva,
  generarTokenReserva,
  verificarTokenReserva,
  generarTokenAdmin,
  verificarTokenAdmin,
  revocarTokenAdmin,
};


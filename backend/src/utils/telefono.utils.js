/**
 * Utilidades para normalización y validación de teléfonos en formato E.164.
 */

/**
 * Normaliza un número telefónico (enfocado en Chile +56 9) a formato E.164 estándar (+569XXXXXXXX).
 *
 * @param {string|null|undefined} raw - Número en cualquier formato (con espacios, guiones, etc.)
 * @returns {string|null} Número en formato canónico "+569XXXXXXXX" o null si no es válido
 */
const normalizarTelefonoChileno = (raw) => {
  if (!raw || typeof raw !== 'string') return null;

  // Extraer solo dígitos numéricos
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // Caso 1: 11 dígitos iniciando en 569 (ej: 56952034275)
  if (digits.length === 11 && digits.startsWith('569')) {
    return `+${digits}`;
  }

  // Caso 2: 10 dígitos iniciando en 56 (ej: 5683276385 -> móvil +56983276385)
  if (digits.length === 10 && digits.startsWith('56')) {
    return `+569${digits.slice(2)}`;
  }

  // Caso 3: 9 dígitos iniciando en 9 (ej: 952034275)
  if (digits.length === 9 && digits.startsWith('9')) {
    return `+56${digits}`;
  }

  // Caso 4: 8 dígitos locales (ej: 52034275)
  if (digits.length === 8) {
    return `+569${digits}`;
  }

  // Caso 5: Formato internacional genérico válido E.164 (10 a 15 dígitos)
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
};

module.exports = {
  normalizarTelefonoChileno,
};

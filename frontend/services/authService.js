/**
 * authService.js
 *
 * Servicio de autenticación para el panel administrativo.
 * Comunica con el backend Express para login/logout y gestión de sesión,
 * usando localStorage para persistir el token entre recargas de página.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const TOKEN_KEY = 'carolina_admin_token';
const USER_KEY = 'carolina_admin_user';

/**
 * Guarda la sesión en localStorage
 * @param {string} token - JWT de acceso
 * @param {object} user  - Datos del usuario
 */
function saveSession(token, user) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Elimina la sesión del localStorage
 */
function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Retorna el token almacenado o null
 * @returns {string|null}
 */
export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Retorna el usuario almacenado o null
 * @returns {object|null}
 */
export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Verifica si hay una sesión activa (token presente en storage)
 * @returns {boolean}
 */
export function isAuthenticated() {
  return Boolean(getToken());
}

/**
 * Inicia sesión contra el backend.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object, access_token: string }>}
 */
export async function login(email, password) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.message || 'Error al iniciar sesión.');
  }

  saveSession(json.data.access_token, json.data.user);
  return json.data;
}

/**
 * Cierra sesión: notifica al backend y limpia el storage local.
 */
export async function logout() {
  const token = getToken();

  try {
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Ignorar errores de red al cerrar sesión — igual limpiamos local
  } finally {
    clearSession();
  }
}

/**
 * Obtiene el usuario actual desde el backend (verifica que el token siga válido).
 * @returns {Promise<object|null>}
 */
export async function fetchCurrentUser() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      clearSession();
      return null;
    }

    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

/**
 * Retorna los headers de autorización para llamadas autenticadas al backend.
 * @returns {object}
 */
export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

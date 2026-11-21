/**
 * apiBase.js
 *
 * Fuente única de verdad para la URL base del backend.
 *
 * - En el navegador: ruta relativa `/api/backend`, que Next.js reescribe hacia el
 *   backend Express (ver `rewrites` en next.config.mjs). Funciona igual en localhost,
 *   en la red local y en producción, sin CORS ni URLs absolutas en el bundle.
 * - En el servidor (SSR / Route Handlers): URL absoluta, porque las rutas relativas
 *   no existen fuera del navegador.
 */
const BROWSER_BASE_URL = '/api/backend';

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    return BROWSER_BASE_URL;
  }
  return process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api/v1';
}


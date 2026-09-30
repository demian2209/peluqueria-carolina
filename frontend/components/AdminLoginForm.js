'use client';

import { useState } from 'react';
import { login } from '../services/authService';

/**
 * AdminLoginForm
 *
 * Formulario de acceso al panel administrativo.
 * Llama a authService.login() y notifica al padre con onLoginSuccess(userData).
 */
export default function AdminLoginForm({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        {/* Logo / Brand */}
        <div className="admin-login-brand">
          <div className="admin-login-logo">
            <span className="material-symbols-outlined">spa</span>
          </div>
          <h1 className="admin-login-title">Peluquería Carolina</h1>
          <p className="admin-login-subtitle">Panel Administrativo</p>
        </div>

        {/* Form */}
        <form id="admin-login-form" onSubmit={handleSubmit} className="admin-login-form" noValidate>
          <div className="admin-form-group">
            <label htmlFor="admin-email" className="admin-form-label">
              Correo electrónico
            </label>
            <div className="admin-input-wrapper">
              <span className="material-symbols-outlined admin-input-icon">mail</span>
              <input
                id="admin-email"
                type="email"
                className="admin-form-input"
                placeholder="admin@peluqueriacarolina.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="admin-password" className="admin-form-label">
              Contraseña
            </label>
            <div className="admin-input-wrapper">
              <span className="material-symbols-outlined admin-input-icon">lock</span>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="admin-form-input admin-form-input--password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                id="admin-toggle-password"
                className="admin-input-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <span className="material-symbols-outlined">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="admin-login-error" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          <button
            id="admin-login-submit"
            type="submit"
            className="admin-login-btn"
            disabled={loading || !email || !password}
          >
            {loading ? (
              <>
                <span className="admin-btn-spinner" />
                Verificando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">login</span>
                Acceder al Panel
              </>
            )}
          </button>
        </form>

        <p className="admin-login-footer">
          Acceso restringido · Solo personal autorizado
        </p>
      </div>
    </div>
  );
}

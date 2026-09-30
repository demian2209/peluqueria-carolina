'use client';

import { useState } from 'react';
import { logout } from '../services/authService';
import AdminReservasList from './AdminReservasList';

const TABS = [
  { id: 'reservas', label: 'Reservas', icon: 'calendar_month' },
  { id: 'servicios', label: 'Servicios', icon: 'content_cut' },
  { id: 'estilistas', label: 'Equipo', icon: 'groups' },
];

/**
 * AdminDashboard
 *
 * Layout principal del panel administrativo.
 * Incluye sidebar con navegación por tabs, header con info del usuario
 * y área de contenido principal.
 */
export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('reservas');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    onLogout();
  };

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'AD';

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logo">
            <span className="material-symbols-outlined">spa</span>
          </div>
          <div>
            <h2 className="admin-sidebar-title">Carolina</h2>
            <span className="admin-sidebar-subtitle">Admin Panel</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Navegación del panel">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              className={`admin-nav-item ${activeTab === tab.id ? 'admin-nav-item--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.id && <span className="admin-nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-chip">
            <div className="admin-user-avatar">{initials}</div>
            <div className="admin-user-info">
              <span className="admin-user-email">{user?.email}</span>
              <span className="admin-user-role">Administrador</span>
            </div>
          </div>
          <button
            id="admin-logout-btn"
            className="admin-logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
            title="Cerrar sesión"
          >
            {loggingOut ? (
              <span className="admin-btn-spinner admin-btn-spinner--sm" />
            ) : (
              <span className="material-symbols-outlined">logout</span>
            )}
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1 className="admin-page-title">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h1>
            <p className="admin-page-subtitle">
              {activeTab === 'reservas' && 'Gestión y seguimiento de todas las citas'}
              {activeTab === 'servicios' && 'Catálogo de servicios del salón'}
              {activeTab === 'estilistas' && 'Equipo de profesionales'}
            </p>
          </div>
        </header>

        <div className="admin-content">
          {activeTab === 'reservas' && <AdminReservasList />}

          {activeTab === 'servicios' && (
            <div className="admin-coming-soon">
              <span className="material-symbols-outlined">content_cut</span>
              <h3>Gestión de Servicios</h3>
              <p>Disponible en la próxima iteración.</p>
            </div>
          )}

          {activeTab === 'estilistas' && (
            <div className="admin-coming-soon">
              <span className="material-symbols-outlined">groups</span>
              <h3>Gestión del Equipo</h3>
              <p>Disponible en la próxima iteración.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

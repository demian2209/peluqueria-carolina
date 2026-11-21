'use client';

import { useState } from 'react';
import { logout } from '../services/authService';
import AdminReservasList from './AdminReservasList';
import AdminServiciosList from './AdminServiciosList';
import AdminBloqueosHorarios from './AdminBloqueosHorarios';
import AdminEquipoList from './AdminEquipoList';
import AdminEncuestasList from './AdminEncuestasList';

const TABS = [
  { id: 'reservas', label: 'Reservas', icon: 'calendar_month' },
  { id: 'horarios', label: 'Horarios y Bloqueos', icon: 'event_busy' },
  { id: 'servicios', label: 'Servicios', icon: 'content_cut' },
  { id: 'estilistas', label: 'Equipo', icon: 'groups' },
  { id: 'encuestas', label: 'Encuestas', icon: 'reviews' },
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
              type="button"
              className={`admin-nav-item ${activeTab === tab.id ? 'admin-nav-item--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              title={tab.label}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{tab.icon}</span>
              <span className="admin-nav-label">{tab.label}</span>
              {activeTab === tab.id && <span className="admin-nav-indicator" aria-hidden="true" />}
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
            aria-label="Cerrar sesión"
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
              {activeTab === 'horarios' && 'Bloqueo de horas, rangos horarios y días completos sincronizado con reservas'}
              {activeTab === 'servicios' && 'Catálogo de servicios del salón — Sección "Nuestra Selección"'}
              {activeTab === 'estilistas' && 'Gestión del personal — Sección "Maestros de la Tijera & Color" y Reservas'}
              {activeTab === 'encuestas' && 'Resultados, calificaciones y comentarios de las encuestas de satisfacción post-atención'}
            </p>
          </div>
        </header>

        <div className="admin-content">
          {activeTab === 'reservas' && <AdminReservasList />}

          {activeTab === 'horarios' && <AdminBloqueosHorarios />}

          {activeTab === 'servicios' && <AdminServiciosList />}

          {activeTab === 'estilistas' && <AdminEquipoList />}

          {activeTab === 'encuestas' && <AdminEncuestasList />}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { logout } from '../services/authService';
import AdminReservasList from './AdminReservasList';
import AdminServiciosList from './AdminServiciosList';
import AdminBloqueosHorarios from './AdminBloqueosHorarios';
import AdminEquipoList from './AdminEquipoList';
import AdminEncuestasList from './AdminEncuestasList';
import AdminChatbotList from './AdminChatbotList';
import AdminKpisDashboard from './AdminKpisDashboard';

const TABS = [
  { id: 'reservas', label: 'Reservas', shortLabel: 'Reservas', icon: 'calendar_month', mobilePrimary: true },
  { id: 'kpis', label: 'KPIs y Analítica', shortLabel: 'KPIs', icon: 'analytics', mobilePrimary: true },
  { id: 'chatbot', label: 'Historial Chatbot', shortLabel: 'Chatbot', icon: 'forum', mobilePrimary: true },
  { id: 'horarios', label: 'Horarios y Bloqueos', shortLabel: 'Horarios', icon: 'event_busy', mobilePrimary: false, description: 'Bloqueo de horas, rangos y días completos' },
  { id: 'servicios', label: 'Servicios', shortLabel: 'Servicios', icon: 'content_cut', mobilePrimary: false, description: 'Catálogo "Nuestra Selección"' },
  { id: 'estilistas', label: 'Equipo', shortLabel: 'Equipo', icon: 'groups', mobilePrimary: false, description: 'Maestros de la Tijera & Color' },
  { id: 'encuestas', label: 'Encuestas', shortLabel: 'Encuestas', icon: 'reviews', mobilePrimary: true },
];

const MOBILE_SECONDARY_TABS = TABS.filter((t) => !t.mobilePrimary);

/**
 * AdminDashboard
 *
 * Layout principal del panel administrativo.
 * En escritorio/tablet muestra los 7 apartados en el sidebar/rail.
 * En móvil (<768px) muestra 4 accesos principales + botón "Más" con Bottom Sheet
 * para evitar amontonamiento y recortes en la barra inferior.
 */
export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('reservas');
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const isSecondaryActive = MOBILE_SECONDARY_TABS.some((t) => t.id === activeTab);

  useEffect(() => {
    if (!mobileMoreOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMoreOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMoreOpen]);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setMobileMoreOpen(false);
  };

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
              className={`admin-nav-item ${activeTab === tab.id ? 'admin-nav-item--active' : ''} ${
                !tab.mobilePrimary ? 'admin-nav-item--secondary-mobile' : ''
              }`}
              onClick={() => handleSelectTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              title={tab.label}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{tab.icon}</span>
              <span className="admin-nav-label admin-nav-label--full">{tab.label}</span>
              <span className="admin-nav-label admin-nav-label--short">{tab.shortLabel}</span>
              {activeTab === tab.id && <span className="admin-nav-indicator" aria-hidden="true" />}
            </button>
          ))}

          {/* Botón "Más" visible únicamente en móvil (<768px) */}
          <button
            id="admin-tab-more-mobile"
            type="button"
            className={`admin-nav-item admin-nav-item--more-mobile ${
              isSecondaryActive || mobileMoreOpen ? 'admin-nav-item--active' : ''
            }`}
            onClick={() => setMobileMoreOpen((prev) => !prev)}
            aria-expanded={mobileMoreOpen}
            aria-controls="admin-mobile-more-sheet"
            aria-label="Más secciones del panel"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {mobileMoreOpen ? 'close' : 'grid_view'}
            </span>
            <span className="admin-nav-label admin-nav-label--short">Más</span>
          </button>
        </nav>

        {/* Bottom Sheet móvil para secciones secundarias (Horarios, Servicios, Equipo) */}
        {mobileMoreOpen && (
          <div
            className="admin-mobile-sheet-overlay"
            onClick={() => setMobileMoreOpen(false)}
            role="presentation"
          >
            <div
              id="admin-mobile-more-sheet"
              className="admin-mobile-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-mobile-sheet-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-mobile-sheet-handle" aria-hidden="true" />
              <div className="admin-mobile-sheet-header">
                <h2 id="admin-mobile-sheet-title" className="admin-mobile-sheet-title">
                  Gestión del Salón
                </h2>
                <button
                  type="button"
                  className="admin-mobile-sheet-close"
                  onClick={() => setMobileMoreOpen(false)}
                  aria-label="Cerrar menú"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>
              <div className="admin-mobile-sheet-list">
                {MOBILE_SECONDARY_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={`admin-sheet-tab-${tab.id}`}
                      type="button"
                      className={`admin-mobile-sheet-item ${isActive ? 'is-active' : ''}`}
                      onClick={() => handleSelectTab(tab.id)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="admin-mobile-sheet-item-icon" aria-hidden="true">
                        <span className="material-symbols-outlined">{tab.icon}</span>
                      </span>
                      <span className="admin-mobile-sheet-item-text">
                        <strong>{tab.label}</strong>
                        {tab.description && <small>{tab.description}</small>}
                      </span>
                      {isActive && (
                        <span className="material-symbols-outlined admin-mobile-sheet-check" aria-hidden="true">
                          check_circle
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
              {activeTab === 'chatbot' && 'Historial de conversaciones del Asistente IA con clasificación multicategoría y seguimiento fuera de horario'}
              {activeTab === 'kpis' && 'Indicadores de confirmaciones, tasas de inasistencia (mensual, semanal y diaria) y rendimiento del chatbot fuera de horario'}
            </p>
          </div>
        </header>

        <div className="admin-content">
          {activeTab === 'reservas' && <AdminReservasList />}

          {activeTab === 'kpis' && <AdminKpisDashboard />}

          {activeTab === 'chatbot' && <AdminChatbotList />}

          {activeTab === 'horarios' && <AdminBloqueosHorarios />}

          {activeTab === 'servicios' && <AdminServiciosList />}

          {activeTab === 'estilistas' && <AdminEquipoList />}

          {activeTab === 'encuestas' && <AdminEncuestasList />}
        </div>
      </main>
    </div>
  );
}

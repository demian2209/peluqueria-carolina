'use client';

import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../services/authService';
import { getApiBaseUrl } from '../services/apiBase';

const ESTADO_CONFIG = {
  pendiente:   { label: 'Pendiente',   icon: 'schedule',      color: 'warning' },
  confirmada:  { label: 'Confirmada',  icon: 'check_circle',  color: 'success' },
  completada:  { label: 'Completada',  icon: 'task_alt',      color: 'info'    },
  cancelada:   { label: 'Cancelada',   icon: 'cancel',        color: 'error'   },
  no_asistio:  { label: 'No asistió',  icon: 'person_off',    color: 'muted'   },
};

/**
 * AdminReservasList
 *
 * Tabla de reservas con filtros por estado/fecha y acciones rápidas:
 * Confirmar y Cancelar.
 */
export default function AdminReservasList() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [accionLoading, setAccionLoading] = useState(null); // id de la reserva en proceso
  const [reservaACancelar, setReservaACancelar] = useState(null);
  const [modalError, setModalError] = useState('');

  const fetchReservas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroFecha)  params.set('fecha', filtroFecha);

      const res = await fetch(`${getApiBaseUrl()}/reservas?${params.toString()}`, {
        cache: 'no-store',
        headers: { ...authHeaders() },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Error al cargar reservas');
      setReservas(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroFecha]);

  useEffect(() => {
    let active = true;
    const initLoad = async () => {
      if (active) await fetchReservas();
    };
    initLoad();
    return () => {
      active = false;
    };
  }, [fetchReservas]);

  const confirmar = async (id) => {
    setAccionLoading(id);
    setError('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/reservas/${id}/confirmar`, {
        method: 'PATCH',
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Error al confirmar');
      }
      await fetchReservas();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccionLoading(null);
    }
  };

  const abrirModalCancelar = (reserva) => {
    setModalError('');
    setReservaACancelar(reserva);
  };

  const cerrarModalCancelar = () => {
    if (accionLoading) return;
    setModalError('');
    setReservaACancelar(null);
  };

  const confirmarCancelacion = async () => {
    if (!reservaACancelar) return;
    const id = reservaACancelar.id;
    setAccionLoading(id);
    setModalError('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/reservas/${id}/cancelar`, {
        method: 'PATCH',
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Error al cancelar');
      }
      setReservaACancelar(null);
      await fetchReservas();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setAccionLoading(null);
    }
  };

  useEffect(() => {
    if (!reservaACancelar) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !accionLoading) {
        setModalError('');
        setReservaACancelar(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reservaACancelar, accionLoading]);

  const totalPorEstado = (estado) => reservas.filter((r) => r.estado === estado).length;

  const reservasFiltradas = reservas.filter((r) => {
    if (!filtroCodigo.trim()) return true;
    const term = filtroCodigo.trim().toLowerCase();
    const cod = String(r.codigo_reserva || r.id || '').toLowerCase();
    const cli = String(r.cliente_nombre || r.clientes?.nombre_completo || '').toLowerCase();
    return cod.includes(term) || cli.includes(term);
  });

  return (
    <div className="admin-reservas">
      {/* Métricas rápidas */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card admin-stat-card--total">
          <span className="material-symbols-outlined">calendar_month</span>
          <div>
            <span className="admin-stat-number">{reservas.length}</span>
            <span className="admin-stat-label">Total</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--warning">
          <span className="material-symbols-outlined">schedule</span>
          <div>
            <span className="admin-stat-number">{totalPorEstado('pendiente')}</span>
            <span className="admin-stat-label">Pendientes</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--success">
          <span className="material-symbols-outlined">check_circle</span>
          <div>
            <span className="admin-stat-number">{totalPorEstado('confirmada')}</span>
            <span className="admin-stat-label">Confirmadas</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--error">
          <span className="material-symbols-outlined">cancel</span>
          <div>
            <span className="admin-stat-number">{totalPorEstado('cancelada')}</span>
            <span className="admin-stat-label">Canceladas</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="admin-filters">
        <div className="admin-filter-group">
          <label htmlFor="filtro-codigo" className="admin-form-label">Código Reserva / Cliente</label>
          <input
            id="filtro-codigo"
            type="text"
            className="admin-form-input"
            placeholder="Ej. PC-18-7F3A"
            value={filtroCodigo}
            onChange={(e) => setFiltroCodigo(e.target.value)}
          />
        </div>
        <div className="admin-filter-group">
          <label htmlFor="filtro-estado" className="admin-form-label">Estado</label>
          <select
            id="filtro-estado"
            className="admin-form-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(ESTADO_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
        <div className="admin-filter-group">
          <label htmlFor="filtro-fecha" className="admin-form-label">Fecha</label>
          <input
            id="filtro-fecha"
            type="date"
            className="admin-form-input admin-form-input--date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
          />
        </div>
        <button
          id="admin-limpiar-filtros"
          className="admin-btn admin-btn--ghost"
          onClick={() => { setFiltroEstado(''); setFiltroFecha(''); setFiltroCodigo(''); }}
        >
          <span className="material-symbols-outlined">filter_alt_off</span>
          Limpiar
        </button>
        <button
          id="admin-refrescar-reservas"
          className="admin-btn admin-btn--primary"
          onClick={fetchReservas}
          disabled={loading}
        >
          <span className="material-symbols-outlined">refresh</span>
          Actualizar
        </button>
      </div>

      {/* Estados de carga y error */}
      {loading && (
        <div className="admin-loading">
          <div className="admin-spinner" />
          <span>Cargando reservas...</span>
        </div>
      )}

      {!loading && error && (
        <div className="admin-error-banner">
          <span className="material-symbols-outlined">warning</span>
          <span>{error}</span>
        </div>
      )}

      {/* Tabla */}
      {!loading && !error && reservasFiltradas.length === 0 && (
        <div className="admin-empty-state">
          <span className="material-symbols-outlined">event_busy</span>
          <p>No hay reservas con los filtros seleccionados.</p>
        </div>
      )}

      {!loading && !error && reservasFiltradas.length > 0 && (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente / Código</th>
                <th>Fecha Cita</th>
                <th>Horario</th>
                <th>Servicio &amp; Valor</th>
                <th>Estilista</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservasFiltradas.map((r) => {
                const cfg = ESTADO_CONFIG[r.estado] || ESTADO_CONFIG.pendiente;
                const isProcessing = accionLoading === r.id;
                const codigoReserva = r.codigo_reserva || `#${r.id}`;

                // Resolución completa de datos de cliente, estilista y servicio
                const nombreEstilista = r.estilistas
                  ? `${r.estilistas.nombre} ${r.estilistas.apellido || ''}`.trim()
                  : r.estilista_nombre || r.estilista_id || '—';
                const nombreServicio = r.servicios
                  ? r.servicios.nombre
                  : r.servicio_nombre || r.servicio_id || '—';
                const nombreCliente = r.cliente_nombre || r.clientes?.nombre_completo || (r.clientes ? `${r.clientes.nombre || ''} ${r.clientes.apellido || ''}`.trim() : '') || '—';
                const telefonoCliente = r.cliente_telefono || r.clientes?.telefono_whatsapp || '';
                const emailCliente = r.cliente_email || r.clientes?.email || '';
                const precio = r.servicios?.precio || r.precio_final || null;
                const duracion = r.servicios?.duracion_min || null;

                // Formateo de fecha amigable (ej: "Vie 27 Nov, 2026")
                let fechaLegible = r.fecha || '—';
                try {
                  const dObj = r.fecha_hora_inicio ? new Date(r.fecha_hora_inicio) : (r.fecha ? new Date(`${r.fecha}T12:00:00`) : null);
                  if (dObj && !isNaN(dObj.getTime())) {
                    fechaLegible = dObj.toLocaleDateString('es-CL', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'America/Santiago'
                    });
                  }
                } catch (_) {}

                const whatsappDigits = telefonoCliente.replace(/\D/g, '');

                return (
                  <tr key={r.id} className={`admin-table-row ${isProcessing ? 'admin-table-row--processing' : ''}`}>
                    <td data-label="Cliente" className="admin-cell-cliente">
                      <div className="admin-client-info">
                        <div className="admin-reserva-code-row">
                          <span className="admin-reserva-code-badge" title="Código único de reserva">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>confirmation_number</span>
                            <span>{codigoReserva}</span>
                          </span>
                        </div>
                        <div className="admin-client-name">
                          <span className="material-symbols-outlined admin-client-avatar">person</span>
                          <span>{nombreCliente}</span>
                        </div>
                        <div className="admin-client-meta">
                          {whatsappDigits && (
                            <a
                              href={`https://wa.me/${whatsappDigits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="admin-contact-link admin-contact-whatsapp"
                              title="Contactar vía WhatsApp"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>chat</span>
                              <span>{telefonoCliente}</span>
                            </a>
                          )}
                          {emailCliente && (
                            <a
                              href={`mailto:${emailCliente}`}
                              className="admin-contact-link admin-contact-email"
                              title="Enviar correo"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>mail</span>
                              <span>{emailCliente}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td data-label="Fecha">
                      <div className="admin-date-wrapper">
                        <span className="material-symbols-outlined admin-date-icon">event</span>
                        <div>
                          <div className="admin-date-text" style={{ textTransform: 'capitalize' }}>{fechaLegible}</div>
                          {r.fecha && <div className="admin-cell-secondary">{r.fecha}</div>}
                        </div>
                      </div>
                    </td>
                    <td data-label="Horario" className="admin-cell-horario">
                      <div className="admin-time-pill">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--secondary)' }}>schedule</span>
                        <span>{r.hora_inicio || '—'} – {r.hora_fin || '—'}</span>
                      </div>
                      {duracion && (
                        <span className="admin-duration-badge">{duracion} minutos</span>
                      )}
                    </td>
                    <td data-label="Servicio">
                      <div className="admin-cell-primary">{nombreServicio}</div>
                      {precio && (
                        <div className="admin-cell-secondary" style={{ color: 'var(--secondary)', fontWeight: 600 }}>
                          ${Number(precio).toLocaleString('es-CL')}
                        </div>
                      )}
                    </td>
                    <td data-label="Estilista">
                      <div className="admin-cell-primary">{nombreEstilista}</div>
                      {r.estilistas?.especialidad && (
                        <div className="admin-cell-secondary">{r.estilistas.especialidad}</div>
                      )}
                    </td>
                    <td data-label="Estado" className="admin-cell-estado">
                      <span className={`admin-badge admin-badge--${cfg.color}`}>
                        <span className="material-symbols-outlined" aria-hidden="true">{cfg.icon}</span>
                        {cfg.label}
                      </span>
                    </td>
                    <td data-label="Acciones" className="admin-cell-acciones">
                      <div className="admin-actions">
                        {r.estado === 'pendiente' && (
                          <button
                            id={`confirmar-${r.id}`}
                            type="button"
                            className="admin-action-btn admin-action-btn--confirm"
                            onClick={() => confirmar(r.id)}
                            disabled={isProcessing}
                            title="Confirmar reserva"
                            aria-label={`Confirmar reserva de ${nombreCliente}`}
                          >
                            {isProcessing ? (
                              <span className="admin-btn-spinner admin-btn-spinner--sm" />
                            ) : (
                              <span className="material-symbols-outlined" aria-hidden="true">check</span>
                            )}
                            <span className="admin-action-label" aria-hidden="true">Confirmar</span>
                          </button>
                        )}
                        {['pendiente', 'confirmada'].includes(r.estado) && (
                          <button
                            id={`cancelar-${r.id}`}
                            type="button"
                            className="admin-action-btn admin-action-btn--cancel"
                            onClick={() =>
                              abrirModalCancelar({
                                id: r.id,
                                codigo_reserva: codigoReserva,
                                cliente_nombre: nombreCliente,
                                servicio_nombre: nombreServicio,
                                fecha_legible: fechaLegible,
                                horario: `${r.hora_inicio || '—'} – ${r.hora_fin || '—'}`,
                              })
                            }
                            disabled={isProcessing}
                            title="Cancelar reserva"
                            aria-label={`Cancelar reserva de ${nombreCliente}`}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">close</span>
                            <span className="admin-action-label" aria-hidden="true">Cancelar</span>
                          </button>
                        )}
                        {!['pendiente', 'confirmada'].includes(r.estado) && (
                          <span className="admin-cell-secondary admin-actions-empty">Sin acciones disponibles</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de confirmación para cancelar reserva */}
      {reservaACancelar && (
        <div
          className="admin-modal-overlay"
          onClick={cerrarModalCancelar}
          role="presentation"
        >
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-modal-cancel-title"
            aria-describedby="admin-modal-cancel-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="admin-modal-icon" aria-hidden="true">
                <span className="material-symbols-outlined">event_busy</span>
              </div>
              <div>
                <h3 id="admin-modal-cancel-title" className="admin-modal-title">
                  ¿Estás seguro de cancelar esta reserva?
                </h3>
                <p id="admin-modal-cancel-desc" className="admin-modal-subtitle">
                  Esta acción liberará el horario seleccionado y notificará al cliente.
                </p>
              </div>
            </div>

            <div className="admin-modal-summary">
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Código:</span>
                <span className="admin-reserva-code-badge">{reservaACancelar.codigo_reserva}</span>
              </div>
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Cliente:</span>
                <strong>{reservaACancelar.cliente_nombre}</strong>
              </div>
              {reservaACancelar.servicio_nombre && (
                <div className="admin-modal-summary-row">
                  <span className="admin-modal-summary-label">Servicio:</span>
                  <span>{reservaACancelar.servicio_nombre}</span>
                </div>
              )}
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Cita:</span>
                <span>{reservaACancelar.fecha_legible} · {reservaACancelar.horario}</span>
              </div>
            </div>

            {modalError && (
              <div className="admin-error-banner admin-modal-error" role="alert">
                <span className="material-symbols-outlined" aria-hidden="true">warning</span>
                <span>{modalError}</span>
              </div>
            )}

            <div className="admin-modal-actions">
              <button
                id="admin-modal-cancelar-btn"
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={cerrarModalCancelar}
                disabled={accionLoading === reservaACancelar.id}
              >
                Cancelar
              </button>
              <button
                id="admin-modal-aceptar-btn"
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={confirmarCancelacion}
                disabled={accionLoading === reservaACancelar.id}
                autoFocus
              >
                {accionLoading === reservaACancelar.id ? (
                  <>
                    <span className="admin-btn-spinner admin-btn-spinner--sm" />
                    <span>Cancelando...</span>
                  </>
                ) : (
                  'Aceptar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

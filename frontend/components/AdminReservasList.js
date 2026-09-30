'use client';

import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../services/authService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

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
  const [accionLoading, setAccionLoading] = useState(null); // id de la reserva en proceso

  const fetchReservas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroFecha)  params.set('fecha', filtroFecha);

      const res = await fetch(`${API_BASE_URL}/reservas?${params.toString()}`, {
        cache: 'no-store',
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
    fetchReservas();
  }, [fetchReservas]);

  const confirmar = async (id) => {
    setAccionLoading(id);
    try {
      const res = await fetch(`${API_BASE_URL}/reservas/${id}/confirmar`, {
        method: 'PATCH',
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Error al confirmar');
      }
      await fetchReservas();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setAccionLoading(null);
    }
  };

  const cancelar = async (id) => {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    setAccionLoading(id);
    try {
      const res = await fetch(`${API_BASE_URL}/reservas/${id}/cancelar`, {
        method: 'PATCH',
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Error al cancelar');
      }
      await fetchReservas();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setAccionLoading(null);
    }
  };

  const totalPorEstado = (estado) => reservas.filter((r) => r.estado === estado).length;

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
          onClick={() => { setFiltroEstado(''); setFiltroFecha(''); }}
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
      {!loading && !error && reservas.length === 0 && (
        <div className="admin-empty-state">
          <span className="material-symbols-outlined">event_busy</span>
          <p>No hay reservas con los filtros seleccionados.</p>
        </div>
      )}

      {!loading && !error && reservas.length > 0 && (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Servicio</th>
                <th>Estilista</th>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((r) => {
                const cfg = ESTADO_CONFIG[r.estado] || ESTADO_CONFIG.pendiente;
                const isProcessing = accionLoading === r.id;

                // Soporte para respuesta Supabase (joins) y mock
                const nombreEstilista = r.estilistas
                  ? `${r.estilistas.nombre} ${r.estilistas.apellido}`
                  : r.estilista_nombre || r.estilista_id || '—';
                const nombreServicio = r.servicios
                  ? r.servicios.nombre
                  : r.servicio_nombre || r.servicio_id || '—';
                const nombreCliente = r.clientes
                  ? `${r.clientes.nombre} ${r.clientes.apellido || ''}`.trim()
                  : r.cliente_nombre || '—';

                return (
                  <tr key={r.id} className={`admin-table-row ${isProcessing ? 'admin-table-row--processing' : ''}`}>
                    <td>
                      <div className="admin-cell-primary">{nombreCliente}</div>
                      <div className="admin-cell-secondary">{r.cliente_email || r.clientes?.email || ''}</div>
                    </td>
                    <td>{nombreServicio}</td>
                    <td>{nombreEstilista}</td>
                    <td>{r.fecha}</td>
                    <td className="admin-cell-horario">
                      {r.hora_inicio} – {r.hora_fin}
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge--${cfg.color}`}>
                        <span className="material-symbols-outlined">{cfg.icon}</span>
                        {cfg.label}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        {r.estado === 'pendiente' && (
                          <button
                            id={`confirmar-${r.id}`}
                            className="admin-action-btn admin-action-btn--confirm"
                            onClick={() => confirmar(r.id)}
                            disabled={isProcessing}
                            title="Confirmar reserva"
                          >
                            {isProcessing ? (
                              <span className="admin-btn-spinner admin-btn-spinner--sm" />
                            ) : (
                              <span className="material-symbols-outlined">check</span>
                            )}
                          </button>
                        )}
                        {['pendiente', 'confirmada'].includes(r.estado) && (
                          <button
                            id={`cancelar-${r.id}`}
                            className="admin-action-btn admin-action-btn--cancel"
                            onClick={() => cancelar(r.id)}
                            disabled={isProcessing}
                            title="Cancelar reserva"
                          >
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        )}
                        {!['pendiente', 'confirmada'].includes(r.estado) && (
                          <span className="admin-cell-secondary">—</span>
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
    </div>
  );
}

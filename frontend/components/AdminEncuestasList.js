'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authHeaders } from '../services/authService';
import {
  getEncuestasAdmin,
  eliminarEncuestaAdmin,
  getEstilistas,
  suscribirActualizacionEncuestas,
  resolverClaveEstilistaPublica,
} from '../services/api';

const PUNTAJE_CONFIG = {
  5: {
    label: '¡Excelente experiencia!',
    shortLabel: 'Excelente',
    color: 'success',
    icon: 'sentiment_very_satisfied',
  },
  4: {
    label: 'Muy buena atención',
    shortLabel: 'Muy buena',
    color: 'info',
    icon: 'sentiment_satisfied',
  },
  3: {
    label: 'Regular / Aceptable',
    shortLabel: 'Regular',
    color: 'warning',
    icon: 'sentiment_neutral',
  },
  2: {
    label: 'Podría mejorar',
    shortLabel: 'Por mejorar',
    color: 'warning',
    icon: 'sentiment_dissatisfied',
  },
  1: {
    label: 'Muy insatisfecho/a',
    shortLabel: 'Insatisfecho',
    color: 'error',
    icon: 'sentiment_extremely_dissatisfied',
  },
};

function formatearFechaHora(isoOrDate) {
  if (!isoOrDate) return '—';
  try {
    const dt = new Date(isoOrDate);
    if (isNaN(dt.getTime())) return String(isoOrDate);
    return dt.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Santiago',
    });
  } catch (_) {
    return String(isoOrDate);
  }
}

function formatearFechaCita(fechaStr) {
  if (!fechaStr) return '—';
  try {
    const dt = new Date(`${String(fechaStr).slice(0, 10)}T12:00:00`);
    if (isNaN(dt.getTime())) return fechaStr;
    return dt.toLocaleDateString('es-CL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Santiago',
    });
  } catch (_) {
    return fechaStr;
  }
}

function renderStars(puntaje, size = '1rem') {
  const p = Math.min(5, Math.max(1, Number(puntaje) || 5));
  return (
    <span
      className="admin-encuestas-stars"
      aria-label={`${p} de 5 estrellas`}
      style={{ fontSize: size }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`admin-encuestas-star ${star <= p ? 'is-filled' : 'is-empty'}`}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * AdminEncuestasList
 *
 * Módulo del panel de administración para visualizar y analizar las respuestas
 * a las encuestas de satisfacción enviadas post-atención.
 */
export default function AdminEncuestasList() {
  const [encuestas, setEncuestas] = useState([]);
  const [estilistas, setEstilistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState('');

  // Filtros
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroPuntaje, setFiltroPuntaje] = useState('');
  const [filtroEstilista, setFiltroEstilista] = useState('');
  const [filtroComentarios, setFiltroComentarios] = useState('');

  // Modales
  const [encuestaDetalle, setEncuestaDetalle] = useState(null);
  const [encuestaAEliminar, setEncuestaAEliminar] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [eliminarError, setEliminarError] = useState('');

  const mostrarFeedback = useCallback((msg) => {
    setFeedbackBanner(msg);
    const timer = setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? '' : prev));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const cargarDatos = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setError('');
    try {
      const [encRes, estData] = await Promise.all([
        getEncuestasAdmin(authHeaders()),
        getEstilistas().catch(() => []),
      ]);
      setEncuestas(Array.isArray(encRes?.items) ? encRes.items : []);
      if (Array.isArray(estData)) {
        setEstilistas(estData);
      }
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las encuestas de satisfacción.');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) await cargarDatos(false);
    })();
    const unsubscribe = suscribirActualizacionEncuestas(() => {
      if (active) cargarDatos(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [cargarDatos]);

  // Cerrar modales con Escape
  useEffect(() => {
    if (!encuestaDetalle && !encuestaAEliminar) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !eliminandoId) {
        if (encuestaDetalle) setEncuestaDetalle(null);
        if (encuestaAEliminar) {
          setEncuestaAEliminar(null);
          setEliminarError('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [encuestaDetalle, encuestaAEliminar, eliminandoId]);

  // Opciones normalizadas de estilistas para el selector
  const opcionesEstilistas = useMemo(() => {
    const map = new Map();
    for (const est of estilistas) {
      const fullName = [est.nombre, est.apellido].filter(Boolean).join(' ').trim();
      const key = resolverClaveEstilistaPublica(est.id, fullName);
      if (key && !map.has(key)) {
        map.set(key, fullName || key);
      }
    }
    for (const enc of encuestas) {
      if (enc.estilista_id && enc.estilista_nombre && !map.has(enc.estilista_id)) {
        map.set(enc.estilista_id, enc.estilista_nombre);
      }
    }
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [estilistas, encuestas]);

  // Estadísticas globales sobre todas las encuestas cargadas
  const stats = useMemo(() => {
    const total = encuestas.length;
    const distribucion = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let suma = 0;
    let positivas = 0;
    let conComentario = 0;

    for (const item of encuestas) {
      const p = Math.min(5, Math.max(1, Number(item.puntaje) || 5));
      distribucion[p] = (distribucion[p] || 0) + 1;
      suma += p;
      if (p >= 4) positivas++;
      if (item.comentario && String(item.comentario).trim().length > 0) {
        conComentario++;
      }
    }

    return {
      total,
      promedio: total > 0 ? Number((suma / total).toFixed(2)) : 0,
      satisfaccion_positiva_pct: total > 0 ? Math.round((positivas / total) * 100) : 0,
      con_comentario: conComentario,
      positivas,
      distribucion,
    };
  }, [encuestas]);

  // Ranking / resumen de satisfacción por profesional
  const resumenPorProfesional = useMemo(() => {
    const acc = new Map();
    for (const item of encuestas) {
      const key = item.estilista_id || item.estilista_nombre || 'general';
      const nombre = item.estilista_nombre || 'Equipo Carolina';
      if (!acc.has(key)) {
        acc.set(key, { key, nombre, total: 0, suma: 0 });
      }
      const entry = acc.get(key);
      entry.total += 1;
      entry.suma += Number(item.puntaje) || 5;
    }
    return Array.from(acc.values())
      .map((e) => ({
        ...e,
        promedio: e.total > 0 ? Number((e.suma / e.total).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.promedio - a.promedio || b.total - a.total);
  }, [encuestas]);

  // Filtrado reactivo
  const encuestasFiltradas = useMemo(() => {
    return encuestas.filter((item) => {
      if (filtroPuntaje && Number(item.puntaje) !== Number(filtroPuntaje)) {
        return false;
      }
      if (filtroEstilista) {
        const itemEstKey = resolverClaveEstilistaPublica(
          item.estilista_id,
          item.estilista_nombre
        );
        if (
          String(item.estilista_id) !== String(filtroEstilista) &&
          String(itemEstKey) !== String(filtroEstilista)
        ) {
          return false;
        }
      }
      if (filtroComentarios === 'con_comentario') {
        if (!item.comentario || !String(item.comentario).trim()) return false;
      } else if (filtroComentarios === 'sin_comentario') {
        if (item.comentario && String(item.comentario).trim()) return false;
      }
      if (filtroBusqueda.trim()) {
        const q = filtroBusqueda.trim().toLowerCase();
        const match =
          String(item.codigo_reserva || '').toLowerCase().includes(q) ||
          String(item.cliente_nombre || '').toLowerCase().includes(q) ||
          String(item.cliente_email || '').toLowerCase().includes(q) ||
          String(item.comentario || '').toLowerCase().includes(q) ||
          String(item.servicio_nombre || '').toLowerCase().includes(q) ||
          String(item.estilista_nombre || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [encuestas, filtroPuntaje, filtroEstilista, filtroComentarios, filtroBusqueda]);

  const handleCopiarEnlaceEncuesta = async (enc) => {
    if (typeof window === 'undefined') return;
    const base = window.location.origin;
    const tokenQs = enc.gestion_token ? `&token=${encodeURIComponent(enc.gestion_token)}` : '';
    const url = `${base}/encuesta?reserva_id=${encodeURIComponent(enc.reserva_id)}${tokenQs}`;
    try {
      await navigator.clipboard.writeText(url);
      mostrarFeedback(`Enlace de encuesta para ${enc.codigo_reserva} copiado al portapapeles.`);
    } catch (_) {
      mostrarFeedback(`Enlace de encuesta: ${url}`);
    }
  };

  const confirmarEliminacion = async () => {
    if (!encuestaAEliminar) return;
    const target = encuestaAEliminar;
    setEliminandoId(target.id);
    setEliminarError('');
    try {
      await eliminarEncuestaAdmin(target.id, authHeaders());
      setEncuestas((prev) => prev.filter((item) => String(item.id) !== String(target.id)));
      if (encuestaDetalle && String(encuestaDetalle.id) === String(target.id)) {
        setEncuestaDetalle(null);
      }
      setEncuestaAEliminar(null);
      mostrarFeedback(
        `Respuesta de encuesta asociada a la reserva ${target.codigo_reserva} eliminada.`
      );
    } catch (err) {
      setEliminarError(err.message || 'No se pudo eliminar la encuesta.');
    } finally {
      setEliminandoId(null);
    }
  };

  const limpiarFiltros = () => {
    setFiltroBusqueda('');
    setFiltroPuntaje('');
    setFiltroEstilista('');
    setFiltroComentarios('');
  };

  return (
    <div className="admin-reservas admin-encuestas">
      {/* KPIs principales */}
      <div className="admin-stats-grid" aria-label="Indicadores de satisfacción">
        <div className="admin-stat-card admin-stat-card--total">
          <span className="material-symbols-outlined" aria-hidden="true">reviews</span>
          <div>
            <span className="admin-stat-number">{stats.total}</span>
            <span className="admin-stat-label">Total Respuestas</span>
          </div>
        </div>

        <div className="admin-stat-card admin-stat-card--warning">
          <span className="material-symbols-outlined" aria-hidden="true">star</span>
          <div>
            <span className="admin-stat-number">
              {stats.total > 0 ? `${stats.promedio.toFixed(1)} / 5.0` : '—'}
            </span>
            <span className="admin-stat-label">Promedio General</span>
          </div>
        </div>

        <div className="admin-stat-card admin-stat-card--success">
          <span className="material-symbols-outlined" aria-hidden="true">
            sentiment_very_satisfied
          </span>
          <div>
            <span className="admin-stat-number">
              {stats.total > 0 ? `${stats.satisfaccion_positiva_pct}%` : '—'}
            </span>
            <span className="admin-stat-label">Satisfacción Positiva (4★ y 5★)</span>
          </div>
        </div>

        <div className="admin-stat-card admin-stat-card--total">
          <span className="material-symbols-outlined" aria-hidden="true">forum</span>
          <div>
            <span className="admin-stat-number">{stats.con_comentario}</span>
            <span className="admin-stat-label">Con Comentario Escrito</span>
          </div>
        </div>
      </div>

      {/* Panel analítico: Distribución por Estrellas + Desempeño por Profesional */}
      {!loading && !error && encuestas.length > 0 && (
        <div className="admin-encuestas-analytics-grid">
          {/* Distribución de calificaciones (5★ a 1★) */}
          <section
            className="admin-encuestas-panel"
            aria-labelledby="titulo-distribucion-estrellas"
          >
            <div className="admin-encuestas-panel-header">
              <div>
                <h2 id="titulo-distribucion-estrellas" className="admin-encuestas-panel-title">
                  Distribución de Calificaciones
                </h2>
                <p className="admin-encuestas-panel-subtitle">
                  Haz clic en un nivel de estrellas para filtrar las respuestas.
                </p>
              </div>
              <div className="admin-encuestas-score-pill">
                <strong>{stats.promedio.toFixed(2)}</strong>
                {renderStars(Math.round(stats.promedio), '0.95rem')}
              </div>
            </div>

            <div className="admin-encuestas-bars">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.distribucion[star] || 0;
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const isSelected = String(filtroPuntaje) === String(star);
                return (
                  <button
                    key={star}
                    type="button"
                    className={`admin-encuestas-bar-row ${isSelected ? 'is-active' : ''}`}
                    onClick={() =>
                      setFiltroPuntaje((prev) =>
                        String(prev) === String(star) ? '' : String(star)
                      )
                    }
                    aria-pressed={isSelected}
                    title={`Filtrar por ${star} estrellas (${count} respuestas)`}
                  >
                    <span className="admin-encuestas-bar-label">
                      <strong>{star}</strong>
                      <span className="admin-encuestas-star is-filled" aria-hidden="true">
                        ★
                      </span>
                    </span>
                    <div className="admin-encuestas-bar-track" aria-hidden="true">
                      <div
                        className={`admin-encuestas-bar-fill admin-encuestas-bar-fill--s${star}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="admin-encuestas-bar-count">
                      {count} <small>({pct}%)</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Desempeño por Profesional */}
          <section
            className="admin-encuestas-panel"
            aria-labelledby="titulo-satisfaccion-equipo"
          >
            <div className="admin-encuestas-panel-header">
              <div>
                <h2 id="titulo-satisfaccion-equipo" className="admin-encuestas-panel-title">
                  Calificación por Profesional
                </h2>
                <p className="admin-encuestas-panel-subtitle">
                  Promedio de satisfacción según las citas evaluadas.
                </p>
              </div>
            </div>

            <ul className="admin-encuestas-stylist-list">
              {resumenPorProfesional.map((prof) => {
                const isSelected =
                  filtroEstilista &&
                  (String(filtroEstilista) === String(prof.key) ||
                    resolverClaveEstilistaPublica(filtroEstilista) ===
                      resolverClaveEstilistaPublica(prof.key, prof.nombre));
                return (
                  <li key={prof.key}>
                    <button
                      type="button"
                      className={`admin-encuestas-stylist-item ${isSelected ? 'is-active' : ''}`}
                      onClick={() =>
                        setFiltroEstilista((prev) =>
                          String(prev) === String(prof.key) ? '' : String(prof.key)
                        )
                      }
                      aria-pressed={Boolean(isSelected)}
                      title={`Filtrar evaluaciones de ${prof.nombre}`}
                    >
                      <div className="admin-encuestas-stylist-info">
                        <span className="material-symbols-outlined admin-client-avatar" aria-hidden="true">
                          person
                        </span>
                        <div>
                          <div className="admin-cell-primary">{prof.nombre}</div>
                          <div className="admin-cell-secondary">
                            {prof.total} {prof.total === 1 ? 'evaluación' : 'evaluaciones'}
                          </div>
                        </div>
                      </div>
                      <div className="admin-encuestas-stylist-rating">
                        <strong>{prof.promedio.toFixed(1)}</strong>
                        {renderStars(Math.round(prof.promedio), '0.9rem')}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {/* Filtros */}
      <div className="admin-filters">
        <div className="admin-filter-group">
          <label htmlFor="filtro-encuestas-busqueda" className="admin-form-label">
            Código / Cliente / Comentario
          </label>
          <input
            id="filtro-encuestas-busqueda"
            type="text"
            className="admin-form-input"
            placeholder="Ej. PC-R1, Constanza o balayage..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
          />
        </div>

        <div className="admin-filter-group">
          <label htmlFor="filtro-encuestas-puntaje" className="admin-form-label">
            Calificación
          </label>
          <select
            id="filtro-encuestas-puntaje"
            className="admin-form-select"
            value={filtroPuntaje}
            onChange={(e) => setFiltroPuntaje(e.target.value)}
          >
            <option value="">Todas las estrellas</option>
            <option value="5">5 ★ — ¡Excelente experiencia!</option>
            <option value="4">4 ★ — Muy buena atención</option>
            <option value="3">3 ★ — Regular / Aceptable</option>
            <option value="2">2 ★ — Podría mejorar</option>
            <option value="1">1 ★ — Muy insatisfecho/a</option>
          </select>
        </div>

        <div className="admin-filter-group">
          <label htmlFor="filtro-encuestas-estilista" className="admin-form-label">
            Profesional
          </label>
          <select
            id="filtro-encuestas-estilista"
            className="admin-form-select"
            value={filtroEstilista}
            onChange={(e) => setFiltroEstilista(e.target.value)}
          >
            <option value="">Todos los profesionales</option>
            {opcionesEstilistas.map((est) => (
              <option key={est.id} value={est.id}>
                {est.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-filter-group">
          <label htmlFor="filtro-encuestas-comentarios" className="admin-form-label">
            Comentarios
          </label>
          <select
            id="filtro-encuestas-comentarios"
            className="admin-form-select"
            value={filtroComentarios}
            onChange={(e) => setFiltroComentarios(e.target.value)}
          >
            <option value="">Todas las respuestas</option>
            <option value="con_comentario">Solo con comentario escrito</option>
            <option value="sin_comentario">Sin comentario escrito</option>
          </select>
        </div>

        <button
          id="admin-encuestas-limpiar-btn"
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={limpiarFiltros}
        >
          <span className="material-symbols-outlined" aria-hidden="true">filter_alt_off</span>
          Limpiar
        </button>

        <button
          id="admin-encuestas-refrescar-btn"
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => cargarDatos(false)}
          disabled={loading}
        >
          <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
          Actualizar
        </button>
      </div>

      {/* Banner de confirmación */}
      {feedbackBanner && (
        <div className="admin-success-banner" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">task_alt</span>
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* Estados de carga, error y vacío */}
      {loading && (
        <div className="admin-loading">
          <div className="admin-spinner" />
          <span>Cargando respuestas de encuestas de satisfacción...</span>
        </div>
      )}

      {!loading && error && (
        <div className="admin-error-banner" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">warning</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && encuestasFiltradas.length === 0 && (
        <div className="admin-empty-state">
          <span className="material-symbols-outlined" aria-hidden="true">reviews</span>
          <p>No se encontraron respuestas de encuestas con los filtros seleccionados.</p>
          {(filtroBusqueda || filtroPuntaje || filtroEstilista || filtroComentarios) && (
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={limpiarFiltros}
            >
              <span className="material-symbols-outlined" aria-hidden="true">filter_alt_off</span>
              Mostrar todas las encuestas
            </button>
          )}
        </div>
      )}

      {/* Tabla de Respuestas de Encuestas */}
      {!loading && !error && encuestasFiltradas.length > 0 && (
        <div className="admin-table-wrapper">
          <table className="admin-table admin-encuestas-table">
            <thead>
              <tr>
                <th>Cliente / Código</th>
                <th>Calificación</th>
                <th>Comentario del Cliente</th>
                <th>Servicio &amp; Profesional</th>
                <th>Fecha Respuesta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {encuestasFiltradas.map((enc) => {
                const p = Math.min(5, Math.max(1, Number(enc.puntaje) || 5));
                const cfg = PUNTAJE_CONFIG[p] || PUNTAJE_CONFIG[5];
                const whatsappDigits = String(enc.cliente_telefono || '').replace(/\D/g, '');
                const tieneComentario = Boolean(enc.comentario && enc.comentario.trim());

                return (
                  <tr key={enc.id} className="admin-table-row">
                    {/* Cliente / Código */}
                    <td data-label="Cliente" className="admin-cell-cliente">
                      <div className="admin-client-info">
                        <div className="admin-reserva-code-row">
                          <span
                            className="admin-reserva-code-badge"
                            title="Código único de la reserva evaluada"
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: '13px' }}
                              aria-hidden="true"
                            >
                              confirmation_number
                            </span>
                            <span>{enc.codigo_reserva}</span>
                          </span>
                        </div>
                        <div className="admin-client-name">
                          <span
                            className="material-symbols-outlined admin-client-avatar"
                            aria-hidden="true"
                          >
                            person
                          </span>
                          <span>{enc.cliente_nombre || 'Cliente'}</span>
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
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '13px' }}
                                aria-hidden="true"
                              >
                                chat
                              </span>
                              <span>{enc.cliente_telefono}</span>
                            </a>
                          )}
                          {enc.cliente_email && enc.cliente_email !== '—' && (
                            <a
                              href={`mailto:${enc.cliente_email}`}
                              className="admin-contact-link admin-contact-email"
                              title="Enviar correo"
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '13px' }}
                                aria-hidden="true"
                              >
                                mail
                              </span>
                              <span>{enc.cliente_email}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Calificación */}
                    <td data-label="Calificación" className="admin-cell-calificacion">
                      <div className="admin-encuestas-rating-cell">
                        {renderStars(p, '1.15rem')}
                        <span className={`admin-badge admin-badge--${cfg.color}`}>
                          <span className="material-symbols-outlined" aria-hidden="true">
                            {cfg.icon}
                          </span>
                          <span>
                            {p}/5 · {cfg.shortLabel}
                          </span>
                        </span>
                      </div>
                    </td>

                    {/* Comentario */}
                    <td data-label="Comentario" className="admin-cell-comentario">
                      {tieneComentario ? (
                        <blockquote className="admin-encuestas-comment-box">
                          <p className="admin-encuestas-comment-text">&ldquo;{enc.comentario}&rdquo;</p>
                        </blockquote>
                      ) : (
                        <span className="admin-cell-secondary admin-encuestas-no-comment">
                          Sin comentario adicional
                        </span>
                      )}
                    </td>

                    {/* Servicio & Profesional */}
                    <td data-label="Servicio & Profesional">
                      <div className="admin-cell-primary">{enc.servicio_nombre || '—'}</div>
                      <div className="admin-cell-secondary" style={{ fontWeight: 600 }}>
                        Atendido por: {enc.estilista_nombre || '—'}
                      </div>
                    </td>

                    {/* Fecha Respuesta y Fecha Cita */}
                    <td data-label="Fecha">
                      <div className="admin-date-wrapper">
                        <span
                          className="material-symbols-outlined admin-date-icon"
                          aria-hidden="true"
                        >
                          schedule
                        </span>
                        <div>
                          <div className="admin-date-text">
                            {formatearFechaHora(enc.respondida_en)}
                          </div>
                          {enc.fecha_cita && (
                            <div className="admin-cell-secondary">
                              Cita: {formatearFechaCita(enc.fecha_cita)}
                              {enc.hora_inicio ? ` (${enc.hora_inicio})` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Acciones */}
                    <td data-label="Acciones" className="admin-cell-acciones">
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="admin-action-btn admin-action-btn--edit"
                          onClick={() => setEncuestaDetalle(enc)}
                          title="Ver detalle completo de la evaluación"
                          aria-label={`Ver detalle de encuesta de ${enc.cliente_nombre}`}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            visibility
                          </span>
                          <span className="admin-action-label" aria-hidden="true">
                            Detalle
                          </span>
                        </button>

                        <button
                          type="button"
                          className="admin-action-btn admin-action-btn--confirm"
                          onClick={() => handleCopiarEnlaceEncuesta(enc)}
                          title="Copiar enlace de la encuesta"
                          aria-label={`Copiar enlace de encuesta de ${enc.cliente_nombre}`}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            link
                          </span>
                          <span className="admin-action-label" aria-hidden="true">
                            Enlace
                          </span>
                        </button>

                        <button
                          type="button"
                          className="admin-action-btn admin-action-btn--cancel"
                          onClick={() => {
                            setEliminarError('');
                            setEncuestaAEliminar(enc);
                          }}
                          title="Eliminar respuesta de encuesta"
                          aria-label={`Eliminar encuesta de ${enc.cliente_nombre}`}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            delete
                          </span>
                          <span className="admin-action-label" aria-hidden="true">
                            Eliminar
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Detalle de Encuesta */}
      {encuestaDetalle && (
        <div
          className="admin-modal-overlay"
          onClick={() => setEncuestaDetalle(null)}
          role="presentation"
        >
          <div
            className="admin-modal-card"
            style={{ maxWidth: '540px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-encuesta-detalle-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header admin-modal-header--between">
              <div className="admin-modal-header-left">
                <div className="admin-modal-icon admin-modal-icon--gold" aria-hidden="true">
                  <span className="material-symbols-outlined">reviews</span>
                </div>
                <div>
                  <h3 id="admin-encuesta-detalle-title" className="admin-modal-title">
                    Detalle de Evaluación
                  </h3>
                  <p className="admin-modal-subtitle">
                    Respondida el {formatearFechaHora(encuestaDetalle.respondida_en)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setEncuestaDetalle(null)}
                aria-label="Cerrar modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Bloque destacado de estrellas y comentario */}
            <div className="admin-encuestas-modal-rating-box">
              {renderStars(encuestaDetalle.puntaje, '1.65rem')}
              <div className="admin-encuestas-modal-rating-label">
                {PUNTAJE_CONFIG[encuestaDetalle.puntaje]?.label || 'Evaluación registrada'} (
                {encuestaDetalle.puntaje}/5)
              </div>
              {encuestaDetalle.comentario ? (
                <blockquote className="admin-encuestas-modal-quote">
                  &ldquo;{encuestaDetalle.comentario}&rdquo;
                </blockquote>
              ) : (
                <p className="admin-cell-secondary" style={{ margin: '0.25rem 0 0' }}>
                  El cliente calificó con estrellas sin dejar un comentario adicional.
                </p>
              )}
            </div>

            {/* Resumen de la cita asociada */}
            <div className="admin-modal-summary">
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Código Reserva:</span>
                <span className="admin-reserva-code-badge">
                  {encuestaDetalle.codigo_reserva}
                </span>
              </div>
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Cliente:</span>
                <strong>{encuestaDetalle.cliente_nombre}</strong>
              </div>
              {encuestaDetalle.servicio_nombre && (
                <div className="admin-modal-summary-row">
                  <span className="admin-modal-summary-label">Servicio:</span>
                  <span>{encuestaDetalle.servicio_nombre}</span>
                </div>
              )}
              {encuestaDetalle.estilista_nombre && (
                <div className="admin-modal-summary-row">
                  <span className="admin-modal-summary-label">Profesional:</span>
                  <span>{encuestaDetalle.estilista_nombre}</span>
                </div>
              )}
              {encuestaDetalle.fecha_cita && (
                <div className="admin-modal-summary-row">
                  <span className="admin-modal-summary-label">Fecha de la Cita:</span>
                  <span>
                    {formatearFechaCita(encuestaDetalle.fecha_cita)}
                    {encuestaDetalle.hora_inicio
                      ? ` · ${encuestaDetalle.hora_inicio}${
                          encuestaDetalle.hora_fin ? ` – ${encuestaDetalle.hora_fin}` : ''
                        }`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => handleCopiarEnlaceEncuesta(encuestaDetalle)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">link</span>
                <span>Copiar Enlace</span>
              </button>
              {encuestaDetalle.cliente_telefono &&
                String(encuestaDetalle.cliente_telefono).replace(/\D/g, '') && (
                  <a
                    href={`https://wa.me/${String(encuestaDetalle.cliente_telefono).replace(
                      /\D/g,
                      ''
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-btn admin-btn--ghost"
                    style={{ textDecoration: 'none' }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">chat</span>
                    <span>WhatsApp</span>
                  </a>
                )}
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => setEncuestaDetalle(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Encuesta */}
      {encuestaAEliminar && (
        <div
          className="admin-modal-overlay"
          onClick={() => {
            if (!eliminandoId) {
              setEncuestaAEliminar(null);
              setEliminarError('');
            }
          }}
          role="presentation"
        >
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-encuesta-delete-title"
            aria-describedby="admin-encuesta-delete-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="admin-modal-icon" aria-hidden="true">
                <span className="material-symbols-outlined">delete</span>
              </div>
              <div>
                <h3 id="admin-encuesta-delete-title" className="admin-modal-title">
                  ¿Eliminar respuesta de encuesta?
                </h3>
                <p id="admin-encuesta-delete-desc" className="admin-modal-subtitle">
                  Se eliminará el registro de evaluación asociado a esta cita.
                </p>
              </div>
            </div>

            <div className="admin-modal-summary">
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Código Reserva:</span>
                <span className="admin-reserva-code-badge">
                  {encuestaAEliminar.codigo_reserva}
                </span>
              </div>
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Cliente:</span>
                <strong>{encuestaAEliminar.cliente_nombre}</strong>
              </div>
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Calificación:</span>
                <span>{encuestaAEliminar.puntaje} / 5 ★</span>
              </div>
            </div>

            {eliminarError && (
              <div className="admin-error-banner admin-modal-error" role="alert">
                <span className="material-symbols-outlined" aria-hidden="true">warning</span>
                <span>{eliminarError}</span>
              </div>
            )}

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setEncuestaAEliminar(null);
                  setEliminarError('');
                }}
                disabled={Boolean(eliminandoId)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={confirmarEliminacion}
                disabled={Boolean(eliminandoId)}
              >
                {eliminandoId ? (
                  <>
                    <span className="admin-btn-spinner admin-btn-spinner--sm" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

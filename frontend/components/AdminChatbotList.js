'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authHeaders } from '../services/authService';
import {
  getConversacionesChatbotAdmin,
  getConversacionChatbotDetalleAdmin,
  suscribirActualizacionChatbot,
} from '../services/api';

const CATEGORIAS_DEFAULT = [
  { id: 'servicios', label: 'Servicios', icon: 'content_cut' },
  { id: 'precios', label: 'Precios', icon: 'payments' },
  { id: 'horarios', label: 'Horarios', icon: 'schedule' },
  { id: 'estilistas', label: 'Estilistas', icon: 'groups' },
  { id: 'reservar_hora', label: 'Reservar hora', icon: 'calendar_add_on' },
  { id: 'cancelar_reprogramar', label: 'Cancelar / Reprogramar', icon: 'event_repeat' },
  { id: 'ubicacion_contacto', label: 'Ubicación y contacto', icon: 'location_on' },
  { id: 'faqs', label: 'FAQs', icon: 'help' },
  { id: 'otros', label: 'Otros', icon: 'chat_bubble' },
];

const CATEGORIA_META_MAP = Object.fromEntries(CATEGORIAS_DEFAULT.map((c) => [c.id, c]));

function formatearFechaHoraChile(iso) {
  if (!iso) return '—';
  try {
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return String(iso);
    return dt.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Santiago',
    });
  } catch (_) {
    return String(iso);
  }
}

function formatearSoloHoraChile(iso) {
  if (!iso) return '';
  try {
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Santiago',
    });
  } catch (_) {
    return '';
  }
}

function getCategoriaLabel(slug) {
  return CATEGORIA_META_MAP[slug]?.label || slug;
}

/**
 * AdminChatbotList
 *
 * Apartado del panel administrativo para auditar el historial de conversaciones
 * del Asistente IA, filtrar por múltiples categorías simultáneamente (AND / OR),
 * franja horaria (fuera de horario laboral) y visualizar el hilo completo del chat.
 */
export default function AdminChatbotList() {
  const [conversaciones, setConversaciones] = useState([]);
  const [stats, setStats] = useState({
    total_conversaciones: 0,
    total_mensajes: 0,
    fuera_horario: 0,
    pct_fuera_horario: 0,
    categoria_top: null,
  });
  const [catalogo, setCatalogo] = useState(CATEGORIAS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  // Filtros
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [modoCategorias, setModoCategorias] = useState('AND'); // 'AND' = todas, 'OR' = alguna
  const [filtroFranja, setFiltroFranja] = useState(''); // '' | 'true' | 'false'
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');

  // Modal de detalle completo
  const [conversacionDetalle, setConversacionDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState('');

  // Debounce ligero para búsqueda de texto
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const fetchConversaciones = useCallback(async () => {
    setLoading(true);
    setError('');
    setWarning('');
    try {
      const res = await getConversacionesChatbotAdmin(
        {
          categorias: categoriasSeleccionadas,
          modo_categorias: modoCategorias,
          fuera_horario: filtroFranja,
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
          busqueda: busquedaAplicada,
        },
        authHeaders()
      );
      setConversaciones(Array.isArray(res?.data) ? res.data : []);
      if (res?.stats) setStats(res.stats);
      if (Array.isArray(res?.categorias_catalogo) && res.categorias_catalogo.length > 0) {
        setCatalogo(res.categorias_catalogo);
      }
      if (res?.warning) setWarning(res.warning);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial del chatbot.');
    } finally {
      setLoading(false);
    }
  }, [categoriasSeleccionadas, modoCategorias, filtroFranja, fechaDesde, fechaHasta, busquedaAplicada]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) await fetchConversaciones();
    })();
    return () => {
      active = false;
    };
  }, [fetchConversaciones]);

  useEffect(() => {
    return suscribirActualizacionChatbot(() => {
      fetchConversaciones();
    });
  }, [fetchConversaciones]);

  const toggleCategoria = (catId) => {
    setCategoriasSeleccionadas((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const limpiarFiltros = () => {
    setCategoriasSeleccionadas([]);
    setModoCategorias('AND');
    setFiltroFranja('');
    setFechaDesde('');
    setFechaHasta('');
    setBusqueda('');
    setBusquedaAplicada('');
  };

  const abrirDetalle = async (conv) => {
    setDetalleError('');
    setDetalleLoading(true);
    setConversacionDetalle({ ...conv, mensajes: [] });
    try {
      const res = await getConversacionChatbotDetalleAdmin(conv.id, authHeaders());
      setConversacionDetalle(res?.data || { ...conv, mensajes: [] });
    } catch (err) {
      setDetalleError(err.message || 'No se pudo cargar el detalle de la conversación.');
    } finally {
      setDetalleLoading(false);
    }
  };

  const cerrarDetalle = () => {
    setConversacionDetalle(null);
    setDetalleError('');
  };

  // Cerrar modal con tecla Escape
  useEffect(() => {
    if (!conversacionDetalle) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cerrarDetalle();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conversacionDetalle]);

  const hayFiltrosActivos = useMemo(
    () =>
      categoriasSeleccionadas.length > 0 ||
      Boolean(filtroFranja) ||
      Boolean(fechaDesde) ||
      Boolean(fechaHasta) ||
      Boolean(busqueda.trim()),
    [categoriasSeleccionadas, filtroFranja, fechaDesde, fechaHasta, busqueda]
  );

  return (
    <div className="admin-reservas admin-chatbot">
      {/* Tarjetas resumen */}
      <div className="admin-stats-grid" aria-label="Resumen de conversaciones del chatbot">
        <div className="admin-stat-card admin-stat-card--total">
          <span className="material-symbols-outlined" aria-hidden="true">forum</span>
          <div>
            <span className="admin-stat-number">{stats.total_conversaciones}</span>
            <span className="admin-stat-label">Conversaciones</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--success">
          <span className="material-symbols-outlined" aria-hidden="true">chat</span>
          <div>
            <span className="admin-stat-number">{stats.total_mensajes}</span>
            <span className="admin-stat-label">Mensajes Totales</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--no-show">
          <span className="material-symbols-outlined" aria-hidden="true">dark_mode</span>
          <div>
            <span className="admin-stat-number">
              {stats.fuera_horario}{' '}
              <small style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.8 }}>
                ({stats.pct_fuera_horario}%)
              </small>
            </span>
            <span className="admin-stat-label">Fuera de Horario</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--warning">
          <span className="material-symbols-outlined" aria-hidden="true">label</span>
          <div>
            <span className="admin-stat-number" style={{ fontSize: '1.1rem' }}>
              {stats.categoria_top ? getCategoriaLabel(stats.categoria_top.id) : '—'}
            </span>
            <span className="admin-stat-label">
              Tema Principal{stats.categoria_top ? ` (${stats.categoria_top.count})` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Panel de filtros y selector multicategoría */}
      <div className="admin-reservas-filter-panel">
        <div className="admin-filters">
          <div className="admin-filter-group">
            <label htmlFor="chatbot-busqueda" className="admin-form-label">Buscar en conversación</label>
            <input
              id="chatbot-busqueda"
              type="text"
              className="admin-form-input"
              placeholder="Ej. balayage, precio, cancelar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="admin-filter-group">
            <label htmlFor="chatbot-franja" className="admin-form-label">Franja Horaria</label>
            <select
              id="chatbot-franja"
              className="admin-form-select"
              value={filtroFranja}
              onChange={(e) => setFiltroFranja(e.target.value)}
            >
              <option value="">Todas las franjas</option>
              <option value="true">Solo fuera de horario laboral</option>
              <option value="false">Solo en horario laboral</option>
            </select>
          </div>

          <div className="admin-filter-group">
            <label htmlFor="chatbot-desde" className="admin-form-label">Desde</label>
            <input
              id="chatbot-desde"
              type="date"
              className="admin-form-input admin-form-input--date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          <div className="admin-filter-group">
            <label htmlFor="chatbot-hasta" className="admin-form-label">Hasta</label>
            <input
              id="chatbot-hasta"
              type="date"
              className="admin-form-input admin-form-input--date"
              min={fechaDesde || undefined}
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>

          <button
            id="admin-chatbot-limpiar"
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={limpiarFiltros}
            disabled={!hayFiltrosActivos}
          >
            <span className="material-symbols-outlined" aria-hidden="true">filter_alt_off</span>
            Limpiar
          </button>

          <button
            id="admin-chatbot-refrescar"
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={fetchConversaciones}
            disabled={loading}
          >
            <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
            Actualizar
          </button>
        </div>

        {/* Barra de Filtros Multicategoría */}
        <div className="admin-chatbot-cats-bar">
          <div className="admin-chatbot-cats-header">
            <span className="admin-form-label">
              Categorías ({categoriasSeleccionadas.length} seleccionadas)
            </span>
            <div className="admin-chatbot-logic-toggle" role="group" aria-label="Lógica de filtro multicategoría">
              <button
                type="button"
                className={`admin-chatbot-logic-btn ${modoCategorias === 'AND' ? 'is-active' : ''}`}
                onClick={() => setModoCategorias('AND')}
                aria-pressed={modoCategorias === 'AND'}
                title="Mostrar solo conversaciones que contengan TODAS las categorías seleccionadas"
              >
                Contiene todas (Y)
              </button>
              <button
                type="button"
                className={`admin-chatbot-logic-btn ${modoCategorias === 'OR' ? 'is-active' : ''}`}
                onClick={() => setModoCategorias('OR')}
                aria-pressed={modoCategorias === 'OR'}
                title="Mostrar conversaciones que contengan AL MENOS UNA de las categorías seleccionadas"
              >
                Contiene alguna (O)
              </button>
            </div>
          </div>

          <div className="admin-chatbot-chips" role="group" aria-label="Filtrar por categorías">
            {catalogo.map((cat) => {
              const active = categoriasSeleccionadas.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  id={`chatbot-cat-${cat.id}`}
                  type="button"
                  className={`admin-chatbot-chip ${active ? 'is-active' : ''}`}
                  onClick={() => toggleCategoria(cat.id)}
                  aria-pressed={active}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {cat.icon || 'label'}
                  </span>
                  <span>{cat.label}</span>
                  {active && (
                    <span className="material-symbols-outlined admin-chatbot-chip-check" aria-hidden="true">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Aviso si la tabla aún no fue migrada */}
      {!loading && warning && (
        <div className="admin-error-banner" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">info</span>
          <span>{warning}</span>
        </div>
      )}

      {/* Carga y error */}
      {loading && (
        <div className="admin-loading">
          <div className="admin-spinner" />
          <span>Cargando historial de conversaciones...</span>
        </div>
      )}

      {!loading && error && (
        <div className="admin-error-banner" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">warning</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && conversaciones.length === 0 && (
        <div className="admin-empty-state">
          <span className="material-symbols-outlined" aria-hidden="true">forum</span>
          <p>No se encontraron conversaciones del chatbot con los filtros seleccionados.</p>
          {hayFiltrosActivos && (
            <button type="button" className="admin-btn admin-btn--ghost" onClick={limpiarFiltros}>
              <span className="material-symbols-outlined" aria-hidden="true">filter_alt_off</span>
              Quitar filtros
            </button>
          )}
        </div>
      )}

      {/* Listado de conversaciones */}
      {!loading && !error && conversaciones.length > 0 && (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha y Hora (Chile)</th>
                <th>Consulta / Sesión</th>
                <th>Categorías</th>
                <th>Franja</th>
                <th>Mensajes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {conversaciones.map((conv) => {
                const cats = Array.isArray(conv.categorias) ? conv.categorias : ['otros'];
                return (
                  <tr key={conv.id} className="admin-table-row">
                    <td data-label="Fecha y Hora">
                      <div className="admin-date-wrapper">
                        <span className="material-symbols-outlined admin-date-icon" aria-hidden="true">
                          schedule
                        </span>
                        <div>
                          <div className="admin-date-text">{formatearFechaHoraChile(conv.iniciada_en)}</div>
                          {conv.ultima_interaccion_en && conv.ultima_interaccion_en !== conv.iniciada_en && (
                            <div className="admin-cell-secondary">
                              Última: {formatearSoloHoraChile(conv.ultima_interaccion_en)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td data-label="Consulta">
                      <div className="admin-cell-primary admin-chatbot-resumen">
                        {conv.resumen || 'Conversación sin extracto'}
                      </div>
                      <div className="admin-cell-secondary">
                        Sesión: <code>{conv.session_id}</code> · Canal: {conv.canal || 'web'}
                      </div>
                    </td>

                    <td data-label="Categorías">
                      <div className="admin-chatbot-tags">
                        {cats.map((slug) => (
                          <span key={slug} className="admin-chatbot-tag">
                            {getCategoriaLabel(slug)}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td data-label="Franja">
                      {conv.fuera_horario_laboral ? (
                        <span className="admin-badge admin-badge--no-show">
                          <span className="material-symbols-outlined" aria-hidden="true">dark_mode</span>
                          Fuera de horario
                        </span>
                      ) : (
                        <span className="admin-badge admin-badge--success">
                          <span className="material-symbols-outlined" aria-hidden="true">wb_sunny</span>
                          Horario laboral
                        </span>
                      )}
                    </td>

                    <td data-label="Mensajes">
                      <span className="admin-duration-badge">{conv.total_mensajes || 0} msgs</span>
                    </td>

                    <td data-label="Acciones" className="admin-cell-acciones">
                      <div className="admin-actions">
                        <button
                          id={`ver-chat-${conv.id}`}
                          type="button"
                          className="admin-action-btn admin-action-btn--edit"
                          onClick={() => abrirDetalle(conv)}
                          title="Ver conversación completa"
                          aria-label={`Ver conversación ${conv.session_id}`}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">visibility</span>
                          <span className="admin-action-label" aria-hidden="true">Ver chat</span>
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

      {/* Modal de detalle completo de la conversación */}
      {conversacionDetalle && (
        <div className="admin-modal-overlay" onClick={cerrarDetalle} role="presentation">
          <div
            className="admin-modal-card admin-chatbot-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-chatbot-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header admin-chatbot-modal-header">
              <div className="admin-modal-icon" aria-hidden="true">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 id="admin-chatbot-modal-title" className="admin-modal-title">
                  Conversación del Chatbot
                </h3>
                <p className="admin-modal-subtitle">
                  Inicio: {formatearFechaHoraChile(conversacionDetalle.iniciada_en)} · Sesión{' '}
                  <code>{conversacionDetalle.session_id}</code>
                </p>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={cerrarDetalle}
                aria-label="Cerrar detalle de conversación"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            <div className="admin-chatbot-modal-meta">
              {conversacionDetalle.fuera_horario_laboral ? (
                <span className="admin-badge admin-badge--no-show">
                  <span className="material-symbols-outlined" aria-hidden="true">dark_mode</span>
                  Fuera de horario laboral
                </span>
              ) : (
                <span className="admin-badge admin-badge--success">
                  <span className="material-symbols-outlined" aria-hidden="true">wb_sunny</span>
                  Horario laboral
                </span>
              )}
              <div className="admin-chatbot-tags">
                {(conversacionDetalle.categorias || []).map((slug) => (
                  <span key={slug} className="admin-chatbot-tag">
                    {getCategoriaLabel(slug)}
                  </span>
                ))}
              </div>
            </div>

            {detalleLoading && (
              <div className="admin-loading" style={{ padding: '2rem 1rem' }}>
                <div className="admin-spinner" />
                <span>Cargando mensajes...</span>
              </div>
            )}

            {!detalleLoading && detalleError && (
              <div className="admin-error-banner" role="alert">
                <span className="material-symbols-outlined" aria-hidden="true">warning</span>
                <span>{detalleError}</span>
              </div>
            )}

            {!detalleLoading && !detalleError && (
              <div className="admin-chatbot-thread" role="log" aria-label="Mensajes de la conversación">
                {(conversacionDetalle.mensajes || []).length === 0 ? (
                  <p className="admin-cell-secondary" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    Esta conversación aún no tiene mensajes registrados.
                  </p>
                ) : (
                  conversacionDetalle.mensajes.map((msg) => {
                    const esUsuario = msg.rol === 'usuario';
                    return (
                      <div
                        key={msg.id}
                        className={`admin-chatbot-bubble ${esUsuario ? 'is-user' : 'is-bot'}`}
                      >
                        <div className="admin-chatbot-bubble-meta">
                          <strong>{esUsuario ? 'Cliente' : 'Asistente IA'}</strong>
                          <span>{formatearFechaHoraChile(msg.creado_en)}</span>
                        </div>
                        <p className="admin-chatbot-bubble-text">{msg.contenido}</p>
                        {esUsuario && Array.isArray(msg.categorias_detectadas) && msg.categorias_detectadas.length > 0 && (
                          <div className="admin-chatbot-bubble-tags">
                            {msg.categorias_detectadas.map((cat) => (
                              <span key={cat} className="admin-chatbot-tag admin-chatbot-tag--sm">
                                {getCategoriaLabel(cat)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={cerrarDetalle}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

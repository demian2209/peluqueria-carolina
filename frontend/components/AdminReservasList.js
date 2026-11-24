'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authHeaders } from '../services/authService';
import { getApiBaseUrl } from '../services/apiBase';

const ESTADO_CONFIG = {
  pendiente:   { label: 'Pendiente',   icon: 'schedule',      color: 'warning' },
  confirmada:  { label: 'Confirmada',  icon: 'check_circle',  color: 'success' },
  atendida:    { label: 'Atendida',    icon: 'task_alt',      color: 'info'    },
  completada:  { label: 'Completada',  icon: 'task_alt',      color: 'info'    },
  cancelada:   { label: 'Cancelada',   icon: 'cancel',        color: 'error'   },
  no_asistio:  { label: 'No asistió',  icon: 'person_off',    color: 'no-show' },
};

const MODOS_FECHA = [
  { id: 'todos',   label: 'Todas',   icon: 'all_inclusive' },
  { id: 'mensual', label: 'Mensual', icon: 'calendar_month' },
  { id: 'semanal', label: 'Semanal', icon: 'date_range' },
  { id: 'diario',  label: 'Diario',  icon: 'today' },
];

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIAS_NOMBRES_LARGOS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
];

function toIsoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getTodayIso() {
  return toIsoDate(new Date());
}

function getCurrentMonthIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function parseIsoDateLocal(isoStr) {
  if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return null;
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Calcula el rango laboral de la semana (por defecto Lunes a Sábado, o Lunes a Domingo si includeSunday = true)
 * a partir de una fecha base YYYY-MM-DD.
 */
function calcularRangoSemana(baseIso, includeSunday = false) {
  const ref = parseIsoDateLocal(baseIso) || new Date();
  const day = ref.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(ref);
  monday.setDate(ref.getDate() + diffToMonday);

  const endDay = new Date(monday);
  endDay.setDate(monday.getDate() + (includeSunday ? 6 : 5)); // +5 = Sábado, +6 = Domingo

  return {
    desde: toIsoDate(monday),
    hasta: toIsoDate(endDay),
  };
}

/**
 * Calcula el primer y último día de un mes en formato "YYYY-MM".
 */
function calcularRangoMes(monthIso) {
  if (!monthIso || !/^\d{4}-\d{2}$/.test(monthIso)) return { desde: '', hasta: '' };
  const [year, month] = monthIso.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1, 12, 0, 0);
  const lastDay = new Date(year, month, 0, 12, 0, 0);
  return {
    desde: toIsoDate(firstDay),
    hasta: toIsoDate(lastDay),
  };
}

/**
 * Formatea una fecha ISO como "Lunes 23" o "Lunes 23 de Noviembre"
 */
function formatearDiaRango(isoStr, incluirMes = false) {
  const d = parseIsoDateLocal(isoStr);
  if (!d) return isoStr || '';
  const nombreDia = DIAS_NOMBRES_LARGOS[d.getDay()];
  const numDia = d.getDate();
  if (!incluirMes) return `${nombreDia} ${numDia}`;
  const nombreMes = MESES_NOMBRES[d.getMonth()];
  return `${nombreDia} ${numDia} de ${nombreMes}`;
}

/**
 * AdminReservasList
 *
 * Tabla de reservas con filtros por estado, filtro de fecha por período
 * (Mensual, Semanal con rango Desde-Hasta, y Diario) y acciones rápidas:
 * Confirmar y Cancelar.
 */
export default function AdminReservasList() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCodigo, setFiltroCodigo] = useState('');

  // Estados del filtro de fecha por período (Mensual, Semanal, Diario, Todas)
  const [modoFecha, setModoFecha] = useState('todos');
  const [filtroFechaDiaria, setFiltroFechaDiaria] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [semanaDesde, setSemanaDesde] = useState('');
  const [semanaHasta, setSemanaHasta] = useState('');

  const [accionLoading, setAccionLoading] = useState(null); // id de la reserva en proceso
  const [reservaACancelar, setReservaACancelar] = useState(null);
  const [reservaNoAsistio, setReservaNoAsistio] = useState(null);
  const [modalError, setModalError] = useState('');

  // Cambiar entre modos de fecha inicializando valores por defecto coherentes
  const handleCambiarModoFecha = (nuevoModo) => {
    setModoFecha(nuevoModo);
    if (nuevoModo === 'diario' && !filtroFechaDiaria) {
      setFiltroFechaDiaria(getTodayIso());
    } else if (nuevoModo === 'mensual' && !filtroMes) {
      setFiltroMes(getCurrentMonthIso());
    } else if (nuevoModo === 'semanal' && (!semanaDesde || !semanaHasta)) {
      const { desde, hasta } = calcularRangoSemana(filtroFechaDiaria || getTodayIso(), false);
      setSemanaDesde(desde);
      setSemanaHasta(hasta);
    }
  };

  // Navegación rápida para el modo Semanal (Semana anterior / Esta semana Lun-Sáb / Semana siguiente)
  const desplazarSemana = (deltaSemanas) => {
    const base = parseIsoDateLocal(semanaDesde) || new Date();
    base.setDate(base.getDate() + deltaSemanas * 7);
    const { desde, hasta } = calcularRangoSemana(toIsoDate(base), false);
    setSemanaDesde(desde);
    setSemanaHasta(hasta);
  };

  const aplicarSemanaActualLunSab = () => {
    const { desde, hasta } = calcularRangoSemana(getTodayIso(), false);
    setSemanaDesde(desde);
    setSemanaHasta(hasta);
  };

  const aplicarSemanaCompletaLunDom = () => {
    const base = semanaDesde || getTodayIso();
    const { desde, hasta } = calcularRangoSemana(base, true);
    setSemanaDesde(desde);
    setSemanaHasta(hasta);
  };

  // Navegación rápida para el modo Diario (Ayer / Hoy / Mañana)
  const desplazarDia = (deltaDias) => {
    const base = parseIsoDateLocal(filtroFechaDiaria || getTodayIso()) || new Date();
    base.setDate(base.getDate() + deltaDias);
    setFiltroFechaDiaria(toIsoDate(base));
  };

  // Navegación rápida para el modo Mensual (Mes anterior / Este mes / Mes siguiente)
  const desplazarMes = (deltaMeses) => {
    const actual = filtroMes && /^\d{4}-\d{2}$/.test(filtroMes) ? filtroMes : getCurrentMonthIso();
    const [y, m] = actual.split('-').map(Number);
    const d = new Date(y, m - 1 + deltaMeses, 1, 12, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    setFiltroMes(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  // Resolver parámetros de consulta de fecha según el modo activo
  const rangoActivo = useMemo(() => {
    if (modoFecha === 'diario' && filtroFechaDiaria) {
      return { fecha: filtroFechaDiaria, desde: filtroFechaDiaria, hasta: filtroFechaDiaria };
    }
    if (modoFecha === 'semanal') {
      const d = semanaDesde && semanaHasta && semanaDesde > semanaHasta ? semanaHasta : semanaDesde;
      const h = semanaDesde && semanaHasta && semanaDesde > semanaHasta ? semanaDesde : semanaHasta;
      return { fecha: '', desde: d || '', hasta: h || '' };
    }
    if (modoFecha === 'mensual' && filtroMes) {
      const { desde, hasta } = calcularRangoMes(filtroMes);
      return { fecha: '', desde, hasta };
    }
    return { fecha: '', desde: '', hasta: '' };
  }, [modoFecha, filtroFechaDiaria, semanaDesde, semanaHasta, filtroMes]);

  // Etiqueta descriptiva del rango seleccionado (ej: "Visualizando citas desde el Lunes 23 al Sábado 28 de Noviembre")
  const resumenPeriodoTexto = useMemo(() => {
    if (modoFecha === 'diario' && filtroFechaDiaria) {
      const d = parseIsoDateLocal(filtroFechaDiaria);
      if (!d) return '';
      return `Visualizando citas del ${formatearDiaRango(filtroFechaDiaria, true)} de ${d.getFullYear()}`;
    }
    if (modoFecha === 'semanal' && (rangoActivo.desde || rangoActivo.hasta)) {
      if (rangoActivo.desde && rangoActivo.hasta) {
        const dIni = parseIsoDateLocal(rangoActivo.desde);
        const dFin = parseIsoDateLocal(rangoActivo.hasta);
        const mismoMes = dIni && dFin && dIni.getMonth() === dFin.getMonth();
        const textoIni = formatearDiaRango(rangoActivo.desde, !mismoMes);
        const textoFin = formatearDiaRango(rangoActivo.hasta, true);
        return `Visualizando las citas desde el ${textoIni} al ${textoFin}`;
      }
      if (rangoActivo.desde) {
        return `Visualizando las citas desde el ${formatearDiaRango(rangoActivo.desde, true)}`;
      }
      return `Visualizando las citas hasta el ${formatearDiaRango(rangoActivo.hasta, true)}`;
    }
    if (modoFecha === 'mensual' && filtroMes && /^\d{4}-\d{2}$/.test(filtroMes)) {
      const [y, m] = filtroMes.split('-').map(Number);
      const nombreMes = MESES_NOMBRES[m - 1] || '';
      return `Visualizando todas las citas de ${nombreMes} ${y} (${rangoActivo.desde} al ${rangoActivo.hasta})`;
    }
    return '';
  }, [modoFecha, filtroFechaDiaria, filtroMes, rangoActivo]);

  const fetchReservas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set('estado', filtroEstado);
      if (rangoActivo.fecha) {
        params.set('fecha', rangoActivo.fecha);
      } else {
        if (rangoActivo.desde) params.set('fecha_desde', rangoActivo.desde);
        if (rangoActivo.hasta) params.set('fecha_hasta', rangoActivo.hasta);
      }

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
  }, [filtroEstado, rangoActivo]);

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

  const abrirModalNoAsistio = (reserva) => {
    setModalError('');
    setReservaNoAsistio(reserva);
  };

  const cerrarModalNoAsistio = () => {
    if (accionLoading) return;
    setModalError('');
    setReservaNoAsistio(null);
  };

  const confirmarNoAsistio = async () => {
    if (!reservaNoAsistio) return;
    const id = reservaNoAsistio.id;
    setAccionLoading(id);
    setModalError('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/reservas/${id}/no-asistio`, {
        method: 'PATCH',
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Error al marcar como No asistió');
      }
      setReservaNoAsistio(null);
      await fetchReservas();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setAccionLoading(null);
    }
  };

  useEffect(() => {
    if (!reservaACancelar && !reservaNoAsistio) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !accionLoading) {
        setModalError('');
        setReservaACancelar(null);
        setReservaNoAsistio(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reservaACancelar, reservaNoAsistio, accionLoading]);

  const limpiarFiltros = () => {
    setFiltroEstado('');
    setFiltroCodigo('');
    setModoFecha('todos');
    setFiltroFechaDiaria('');
    setFiltroMes('');
    setSemanaDesde('');
    setSemanaHasta('');
  };

  const reservasFiltradas = reservas.filter((r) => {
    // Respaldo de filtrado por rango en cliente por consistencia inmediata
    if (rangoActivo.fecha && r.fecha && r.fecha !== rangoActivo.fecha) return false;
    if (!rangoActivo.fecha) {
      if (rangoActivo.desde && r.fecha && r.fecha < rangoActivo.desde) return false;
      if (rangoActivo.hasta && r.fecha && r.fecha > rangoActivo.hasta) return false;
    }

    if (!filtroCodigo.trim()) return true;
    const term = filtroCodigo.trim().toLowerCase();
    const cod = String(r.codigo_reserva || r.id || '').toLowerCase();
    const cli = String(r.cliente_nombre || r.clientes?.nombre_completo || '').toLowerCase();
    return cod.includes(term) || cli.includes(term);
  });

  const totalPorEstado = (estado) => reservasFiltradas.filter((r) => r.estado === estado).length;

  return (
    <div className="admin-reservas">
      {/* Métricas rápidas */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card admin-stat-card--total">
          <span className="material-symbols-outlined">calendar_month</span>
          <div>
            <span className="admin-stat-number">{reservasFiltradas.length}</span>
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
        <div className="admin-stat-card admin-stat-card--no-show">
          <span className="material-symbols-outlined">person_off</span>
          <div>
            <span className="admin-stat-number">{totalPorEstado('no_asistio')}</span>
            <span className="admin-stat-label">
              No asistió
              {reservasFiltradas.length > 0
                ? ` (${((totalPorEstado('no_asistio') / reservasFiltradas.length) * 100).toFixed(1)}%)`
                : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Filtros principales y Selector de Período de Fecha (Mensual / Semanal / Diario) */}
      <div className="admin-reservas-filter-panel">
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

          <div className="admin-filter-group admin-filter-group--periodo">
            <span className="admin-form-label" id="filtro-periodo-label">Filtro de Fecha</span>
            <div className="admin-date-mode-tabs" role="group" aria-labelledby="filtro-periodo-label">
              {MODOS_FECHA.map((m) => (
                <button
                  key={m.id}
                  id={`filtro-modo-${m.id}`}
                  type="button"
                  className={`admin-date-mode-tab ${modoFecha === m.id ? 'is-active' : ''}`}
                  onClick={() => handleCambiarModoFecha(m.id)}
                  aria-pressed={modoFecha === m.id}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            id="admin-limpiar-filtros"
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={limpiarFiltros}
          >
            <span className="material-symbols-outlined">filter_alt_off</span>
            Limpiar
          </button>
          <button
            id="admin-refrescar-reservas"
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={fetchReservas}
            disabled={loading}
          >
            <span className="material-symbols-outlined">refresh</span>
            Actualizar
          </button>
        </div>

        {/* Sub-barra dinámica según el modo de fecha elegido: Mensual, Semanal (Rango) o Diario */}
        {modoFecha !== 'todos' && (
          <div className="admin-date-period-bar">
            {modoFecha === 'mensual' && (
              <div className="admin-date-period-controls">
                <div className="admin-filter-group">
                  <label htmlFor="filtro-mes" className="admin-form-label">Seleccionar Mes</label>
                  <div className="admin-date-input-nav">
                    <button
                      type="button"
                      className="admin-date-step-btn"
                      onClick={() => desplazarMes(-1)}
                      title="Mes anterior"
                      aria-label="Mes anterior"
                    >
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <input
                      id="filtro-mes"
                      type="month"
                      className="admin-form-input admin-form-input--date"
                      value={filtroMes}
                      onChange={(e) => setFiltroMes(e.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-date-step-btn"
                      onClick={() => desplazarMes(1)}
                      title="Mes siguiente"
                      aria-label="Mes siguiente"
                    >
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </div>
                <div className="admin-date-quick-actions">
                  <button
                    type="button"
                    className="admin-date-quick-chip"
                    onClick={() => setFiltroMes(getCurrentMonthIso())}
                  >
                    Este mes
                  </button>
                </div>
              </div>
            )}

            {modoFecha === 'semanal' && (
              <div className="admin-date-period-controls admin-date-period-controls--semanal">
                <div className="admin-date-range-inputs">
                  <div className="admin-filter-group">
                    <label htmlFor="filtro-semana-desde" className="admin-form-label">Desde (Inicio de semana)</label>
                    <input
                      id="filtro-semana-desde"
                      type="date"
                      className="admin-form-input admin-form-input--date"
                      value={semanaDesde}
                      onChange={(e) => {
                        const nuevoDesde = e.target.value;
                        setSemanaDesde(nuevoDesde);
                        // Si no hay fecha 'hasta' o quedó anterior, ajustar automáticamente a Sábado (+5 días)
                        if (nuevoDesde && (!semanaHasta || semanaHasta < nuevoDesde)) {
                          const d = parseIsoDateLocal(nuevoDesde);
                          if (d) {
                            const sab = new Date(d);
                            sab.setDate(d.getDate() + 5);
                            setSemanaHasta(toIsoDate(sab));
                          }
                        }
                      }}
                    />
                  </div>

                  <span className="admin-date-range-sep" aria-hidden="true">
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </span>

                  <div className="admin-filter-group">
                    <label htmlFor="filtro-semana-hasta" className="admin-form-label">Hasta (Fin de rango)</label>
                    <input
                      id="filtro-semana-hasta"
                      type="date"
                      className="admin-form-input admin-form-input--date"
                      min={semanaDesde || undefined}
                      value={semanaHasta}
                      onChange={(e) => setSemanaHasta(e.target.value)}
                    />
                  </div>
                </div>

                <div className="admin-date-quick-actions">
                  <button
                    type="button"
                    className="admin-date-step-btn"
                    onClick={() => desplazarSemana(-1)}
                    title="Semana anterior (Lunes a Sábado)"
                    aria-label="Semana anterior"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    className="admin-date-quick-chip"
                    onClick={aplicarSemanaActualLunSab}
                    title="Fijar de Lunes a Sábado de la semana actual"
                  >
                    Esta semana (Lun – Sáb)
                  </button>
                  <button
                    type="button"
                    className="admin-date-quick-chip"
                    onClick={aplicarSemanaCompletaLunDom}
                    title="Incluir también el Domingo de la semana seleccionada"
                  >
                    Lun – Dom
                  </button>
                  <button
                    type="button"
                    className="admin-date-step-btn"
                    onClick={() => desplazarSemana(1)}
                    title="Semana siguiente (Lunes a Sábado)"
                    aria-label="Semana siguiente"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
            )}

            {modoFecha === 'diario' && (
              <div className="admin-date-period-controls">
                <div className="admin-filter-group">
                  <label htmlFor="filtro-fecha" className="admin-form-label">Seleccionar Día</label>
                  <div className="admin-date-input-nav">
                    <button
                      type="button"
                      className="admin-date-step-btn"
                      onClick={() => desplazarDia(-1)}
                      title="Día anterior"
                      aria-label="Día anterior"
                    >
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <input
                      id="filtro-fecha"
                      type="date"
                      className="admin-form-input admin-form-input--date"
                      value={filtroFechaDiaria}
                      onChange={(e) => setFiltroFechaDiaria(e.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-date-step-btn"
                      onClick={() => desplazarDia(1)}
                      title="Día siguiente"
                      aria-label="Día siguiente"
                    >
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </div>
                <div className="admin-date-quick-actions">
                  <button
                    type="button"
                    className="admin-date-quick-chip"
                    onClick={() => setFiltroFechaDiaria(getTodayIso())}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    className="admin-date-quick-chip"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setFiltroFechaDiaria(toIsoDate(d));
                    }}
                  >
                    Mañana
                  </button>
                </div>
              </div>
            )}

            {resumenPeriodoTexto && (
              <div className="admin-date-range-banner" role="status" aria-live="polite">
                <span className="material-symbols-outlined" aria-hidden="true">event_note</span>
                <span>{resumenPeriodoTexto}</span>
              </div>
            )}
          </div>
        )}
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
                            id={`no-asistio-${r.id}`}
                            type="button"
                            className="admin-action-btn admin-action-btn--no-show"
                            onClick={() =>
                              abrirModalNoAsistio({
                                id: r.id,
                                codigo_reserva: codigoReserva,
                                cliente_nombre: nombreCliente,
                                servicio_nombre: nombreServicio,
                                fecha_legible: fechaLegible,
                                horario: `${r.hora_inicio || '—'} – ${r.hora_fin || '—'}`,
                              })
                            }
                            disabled={isProcessing}
                            title="Marcar como No asistió"
                            aria-label={`Marcar como No asistió la reserva de ${nombreCliente}`}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">person_off</span>
                            <span className="admin-action-label" aria-hidden="true">No asistió</span>
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

      {/* Modal de confirmación para marcar reserva como No asistió */}
      {reservaNoAsistio && (
        <div
          className="admin-modal-overlay"
          onClick={cerrarModalNoAsistio}
          role="presentation"
        >
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-modal-noshow-title"
            aria-describedby="admin-modal-noshow-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="admin-modal-icon admin-modal-icon--no-show" aria-hidden="true">
                <span className="material-symbols-outlined">person_off</span>
              </div>
              <div>
                <h3 id="admin-modal-noshow-title" className="admin-modal-title">
                  ¿Marcar esta cita como &ldquo;No asistió&rdquo;?
                </h3>
                <p id="admin-modal-noshow-desc" className="admin-modal-subtitle">
                  Esta acción registrará la inasistencia del cliente y se reflejará en los KPIs de inasistencias.
                </p>
              </div>
            </div>

            <div className="admin-modal-summary">
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Código:</span>
                <span className="admin-reserva-code-badge">{reservaNoAsistio.codigo_reserva}</span>
              </div>
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Cliente:</span>
                <strong>{reservaNoAsistio.cliente_nombre}</strong>
              </div>
              {reservaNoAsistio.servicio_nombre && (
                <div className="admin-modal-summary-row">
                  <span className="admin-modal-summary-label">Servicio:</span>
                  <span>{reservaNoAsistio.servicio_nombre}</span>
                </div>
              )}
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Cita:</span>
                <span>{reservaNoAsistio.fecha_legible} · {reservaNoAsistio.horario}</span>
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
                id="admin-modal-noshow-cancelar-btn"
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={cerrarModalNoAsistio}
                disabled={accionLoading === reservaNoAsistio.id}
              >
                Volver
              </button>
              <button
                id="admin-modal-noshow-aceptar-btn"
                type="button"
                className="admin-btn admin-btn--no-show"
                onClick={confirmarNoAsistio}
                disabled={accionLoading === reservaNoAsistio.id}
                autoFocus
              >
                {accionLoading === reservaNoAsistio.id ? (
                  <>
                    <span className="admin-btn-spinner admin-btn-spinner--sm" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  'Confirmar inasistencia'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

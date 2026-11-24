'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authHeaders } from '../services/authService';
import { getKpisResumenAdmin } from '../services/api';

const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const CATEGORIAS_LABELS = {
  servicios: 'Servicios',
  precios: 'Precios',
  horarios: 'Horarios',
  estilistas: 'Estilistas',
  reservar_hora: 'Reservar hora',
  cancelar_reprogramar: 'Cancelar / Reprogramar',
  ubicacion_contacto: 'Ubicación y contacto',
  faqs: 'FAQs',
  otros: 'Otros',
};

function formatearMes(yyyyMm) {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm || '—';
  const [y, m] = yyyyMm.split('-').map(Number);
  return `${MESES_LARGOS[m - 1] || m} ${y}`;
}

function formatearFechaCorta(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '—';
  const [, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MESES_CORTOS[m - 1] || m}`;
}

function formatearFechaDia(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '—';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return dt.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getCurrentMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = new Date(y, m, 0).getDate();
  return {
    desde: `${y}-${pad(m)}-01`,
    hasta: `${y}-${pad(m)}-${pad(lastDay)}`,
  };
}

function getSeverityClass(tasaPct) {
  const n = Number(tasaPct) || 0;
  if (n >= 25) return 'is-high';
  if (n >= 15) return 'is-medium';
  return 'is-low';
}

function formatPct(val) {
  const n = Number(val);
  if (isNaN(n)) return '0,0%';
  return `${n.toFixed(1).replace('.', ',')}%`;
}

/**
 * AdminKpisDashboard
 *
 * Módulo dedicado de analítica y KPIs en el Panel de Administración:
 *   1. Confirmaciones de reservas (total actual en el sistema).
 *   2. Inasistencias (Mensual, Semanal con verificación de citas programadas y tasa semanal, y Diaria).
 *   3. Rendimiento del Chatbot fuera de horario laboral (conversaciones, interacciones y distribución horaria).
 */
export default function AdminKpisDashboard() {
  // Por defecto arranca en Octubre 2026 para visualización directa del período de métricas
  const [preset, setPreset] = useState('octubre_2026');
  const [fechaDesde, setFechaDesde] = useState('2026-10-01');
  const [fechaHasta, setFechaHasta] = useState('2026-10-31');
  const [vistaInasistencia, setVistaInasistencia] = useState('semanal'); // 'semanal' | 'mensual' | 'diaria'

  const [data, setData] = useState(null);
  const [source, setSource] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const aplicarPreset = (nuevoPreset) => {
    setPreset(nuevoPreset);
    if (nuevoPreset === 'octubre_2026') {
      setFechaDesde('2026-10-01');
      setFechaHasta('2026-10-31');
    } else if (nuevoPreset === 'mes_actual') {
      const { desde, hasta } = getCurrentMonthRange();
      setFechaDesde(desde);
      setFechaHasta(hasta);
    } else if (nuevoPreset === 'todo') {
      setFechaDesde('');
      setFechaHasta('');
    }
  };

  const cargarKpis = useCallback(async () => {
    setLoading(true);
    setError('');
    setWarning('');
    try {
      const res = await getKpisResumenAdmin(
        { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
        authHeaders()
      );
      setData(res?.data || null);
      setSource(res?.source || '');
      if (res?.warning) setWarning(res.warning);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los KPIs.');
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) await cargarKpis();
    })();
    return () => {
      active = false;
    };
  }, [cargarKpis]);

  const confirmaciones = data?.confirmaciones || {};
  const inasistencias = data?.inasistencias || {};
  const resumenInas = inasistencias.resumen_periodo || {};
  const seriesMensual = useMemo(() => inasistencias.mensual || [], [inasistencias.mensual]);
  const seriesSemanal = useMemo(() => inasistencias.semanal || [], [inasistencias.semanal]);
  const seriesDiaria = useMemo(() => inasistencias.diaria || [], [inasistencias.diaria]);
  const chatbot = data?.chatbot || {};

  // Métricas derivadas para tarjeta de tasa semanal
  const statsSemanal = useMemo(() => {
    if (!seriesSemanal.length) return { promedio: 0, pico: null, semanas: 0 };
    const suma = seriesSemanal.reduce((acc, w) => acc + (Number(w.tasa_inasistencia_pct) || 0), 0);
    const promedio = Number((suma / seriesSemanal.length).toFixed(1));
    const pico = seriesSemanal.reduce(
      (max, w) => (!max || Number(w.tasa_inasistencia_pct) > Number(max.tasa_inasistencia_pct) ? w : max),
      null
    );
    return { promedio, pico, semanas: seriesSemanal.length };
  }, [seriesSemanal]);

  const maxPorHora = useMemo(() => {
    const dist = chatbot.distribucion_por_hora || [];
    return Math.max(1, ...dist.map((h) => Number(h.total) || 0));
  }, [chatbot.distribucion_por_hora]);

  const horarioResumenTexto = useMemo(() => {
    const cfg = chatbot.horario_configurado || [];
    if (!cfg.length) return 'Lun–Sáb 09:00–19:00 · Dom 10:00–18:00 (Chile)';
    const dom = cfg.find((d) => Number(d.dia_semana) === 0);
    const lun = cfg.find((d) => Number(d.dia_semana) === 1);
    const p1 = lun?.abierto ? `Lun–Sáb ${lun.hora_apertura}–${lun.hora_cierre}` : 'Lun–Sáb cerrado';
    const p2 = dom?.abierto ? `Dom ${dom.hora_apertura}–${dom.hora_cierre}` : 'Dom cerrado';
    return `${p1} · ${p2} (Chile)`;
  }, [chatbot.horario_configurado]);

  return (
    <div className="admin-reservas admin-kpis">
      {/* Barra superior de selección de período */}
      <div className="admin-reservas-filter-panel">
        <div className="admin-kpis-toolbar">
          <div className="admin-date-mode-tabs" role="group" aria-label="Períodos rápidos">
            <button
              id="kpi-preset-octubre"
              type="button"
              className={`admin-date-mode-tab ${preset === 'octubre_2026' ? 'is-active' : ''}`}
              onClick={() => aplicarPreset('octubre_2026')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
              <span>Octubre 2026</span>
            </button>
            <button
              id="kpi-preset-mes-actual"
              type="button"
              className={`admin-date-mode-tab ${preset === 'mes_actual' ? 'is-active' : ''}`}
              onClick={() => aplicarPreset('mes_actual')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">today</span>
              <span>Mes actual</span>
            </button>
            <button
              id="kpi-preset-todo"
              type="button"
              className={`admin-date-mode-tab ${preset === 'todo' ? 'is-active' : ''}`}
              onClick={() => aplicarPreset('todo')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">all_inclusive</span>
              <span>Todo el historial</span>
            </button>
          </div>

          <div className="admin-kpis-dates">
            <div className="admin-filter-group">
              <label htmlFor="kpi-desde" className="admin-form-label">Desde</label>
              <input
                id="kpi-desde"
                type="date"
                className="admin-form-input admin-form-input--date"
                value={fechaDesde}
                onChange={(e) => {
                  setPreset('custom');
                  setFechaDesde(e.target.value);
                }}
              />
            </div>
            <div className="admin-filter-group">
              <label htmlFor="kpi-hasta" className="admin-form-label">Hasta</label>
              <input
                id="kpi-hasta"
                type="date"
                className="admin-form-input admin-form-input--date"
                min={fechaDesde || undefined}
                value={fechaHasta}
                onChange={(e) => {
                  setPreset('custom');
                  setFechaHasta(e.target.value);
                }}
              />
            </div>
            <button
              id="kpi-refrescar"
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={cargarKpis}
              disabled={loading}
            >
              <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {!loading && warning && (
        <div className="admin-error-banner" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">info</span>
          <span>{warning}</span>
        </div>
      )}

      {loading && (
        <div className="admin-loading">
          <div className="admin-spinner" />
          <span>Calculando indicadores y métricas...</span>
        </div>
      )}

      {!loading && error && (
        <div className="admin-error-banner" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">warning</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* BLOQUE 1: Tarjetas KPI Principales */}
          <div className="admin-kpis-hero-grid" aria-label="Indicadores clave de rendimiento">
            {/* KPI 1: Confirmaciones de Reservas */}
            <article className="admin-kpi-card admin-kpi-card--success">
              <div className="admin-kpi-card-top">
                <span className="admin-kpi-card-title">Confirmaciones de Reservas</span>
                <span className="material-symbols-outlined admin-kpi-card-icon" aria-hidden="true">
                  check_circle
                </span>
              </div>
              <div className="admin-kpi-card-value">
                {confirmaciones.total_confirmadas_actual ?? 0}
              </div>
              <p className="admin-kpi-card-sub">
                Total actual confirmadas en el sistema ({formatPct(confirmaciones.tasa_confirmacion_pct)} de{' '}
                {confirmaciones.total_reservas_sistema ?? 0} reservas)
              </p>
              <div className="admin-kpi-card-foot">
                En período seleccionado: <strong>{resumenInas.confirmadas ?? 0}</strong> confirmadas
              </div>
            </article>

            {/* KPI 2A: Tasa de Inasistencia del Período */}
            <article className="admin-kpi-card admin-kpi-card--noshow">
              <div className="admin-kpi-card-top">
                <span className="admin-kpi-card-title">Inasistencias del Período</span>
                <span className="material-symbols-outlined admin-kpi-card-icon" aria-hidden="true">
                  person_off
                </span>
              </div>
              <div className="admin-kpi-card-value">
                {formatPct(resumenInas.tasa_inasistencia_pct)}
              </div>
              <p className="admin-kpi-card-sub">
                <strong>{resumenInas.total_no_asistio ?? 0}</strong> de{' '}
                <strong>{resumenInas.total_programadas ?? 0}</strong> citas programadas no asistieron
              </p>
              <div className="admin-kpi-card-foot">
                Atendidas: {resumenInas.atendidas ?? 0} · Canceladas: {resumenInas.canceladas ?? 0} · Pend.:{' '}
                {resumenInas.pendientes ?? 0}
              </div>
            </article>

            {/* KPI 2B: Tasa de Inasistencia Semanal */}
            <article className="admin-kpi-card admin-kpi-card--warning">
              <div className="admin-kpi-card-top">
                <span className="admin-kpi-card-title">Tasa Inasistencia Semanal</span>
                <span className="material-symbols-outlined admin-kpi-card-icon" aria-hidden="true">
                  date_range
                </span>
              </div>
              <div className="admin-kpi-card-value">
                {formatPct(statsSemanal.promedio)}
              </div>
              <p className="admin-kpi-card-sub">
                Promedio entre <strong>{statsSemanal.semanas}</strong>{' '}
                {statsSemanal.semanas === 1 ? 'semana analizada' : 'semanas analizadas'}
              </p>
              <div className="admin-kpi-card-foot">
                {statsSemanal.pico ? (
                  <>
                    Pico: <strong>{formatPct(statsSemanal.pico.tasa_inasistencia_pct)}</strong> (sem.{' '}
                    {formatearFechaCorta(statsSemanal.pico.semana_inicio)})
                  </>
                ) : (
                  'Sin semanas con datos en el período'
                )}
              </div>
            </article>

            {/* KPI 3: Rendimiento Chatbot Fuera de Horario */}
            <article className="admin-kpi-card admin-kpi-card--info">
              <div className="admin-kpi-card-top">
                <span className="admin-kpi-card-title">Chatbot Fuera de Horario</span>
                <span className="material-symbols-outlined admin-kpi-card-icon" aria-hidden="true">
                  dark_mode
                </span>
              </div>
              <div className="admin-kpi-card-value">
                {formatPct(chatbot.pct_conversaciones_fuera_horario)}
              </div>
              <p className="admin-kpi-card-sub">
                <strong>{chatbot.conversaciones_fuera_horario ?? 0}</strong> de{' '}
                <strong>{chatbot.total_conversaciones ?? 0}</strong> conversaciones atendidas fuera de horario
              </p>
              <div className="admin-kpi-card-foot">
                Interacciones (mensajes): <strong>{chatbot.interacciones_fuera_horario ?? 0}</strong> /{' '}
                {chatbot.total_interacciones ?? 0} ({formatPct(chatbot.pct_interacciones_fuera_horario)})
              </div>
            </article>
          </div>

          {/* BLOQUE 2: Analítica de Inasistencias (Mensual, Semanal y Diaria) */}
          <section className="admin-kpi-panel" aria-labelledby="kpi-inasistencias-heading">
            <div className="admin-kpi-panel-header">
              <div>
                <h2 id="kpi-inasistencias-heading" className="admin-kpi-panel-title">
                  Desglose de Inasistencias (Citas Programadas vs. No Asistió)
                </h2>
                <p className="admin-kpi-panel-subtitle">
                  Verifica las citas programadas y la tasa de inasistencia por semana, mes o día.
                </p>
              </div>
              <div className="admin-date-mode-tabs" role="tablist" aria-label="Granularidad de inasistencias">
                {[
                  { id: 'semanal', label: 'Semanal', icon: 'date_range' },
                  { id: 'mensual', label: 'Mensual', icon: 'calendar_month' },
                  { id: 'diaria', label: 'Diaria', icon: 'today' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    id={`kpi-inasistencia-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={vistaInasistencia === tab.id}
                    className={`admin-date-mode-tab ${vistaInasistencia === tab.id ? 'is-active' : ''}`}
                    onClick={() => setVistaInasistencia(tab.id)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Vista Semanal */}
            {vistaInasistencia === 'semanal' && (
              seriesSemanal.length === 0 ? (
                <div className="admin-empty-state">
                  <span className="material-symbols-outlined" aria-hidden="true">event_busy</span>
                  <p>No hay citas registradas en el período seleccionado.</p>
                </div>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Semana (Lun – Dom)</th>
                        <th>Citas Programadas</th>
                        <th>No asistió</th>
                        <th>Confirmadas</th>
                        <th>Atendidas</th>
                        <th>Canceladas</th>
                        <th>Tasa Inasistencia Semanal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seriesSemanal.map((w, idx) => {
                        const sev = getSeverityClass(w.tasa_inasistencia_pct);
                        return (
                          <tr key={w.semana_inicio} className="admin-table-row">
                            <td data-label="Semana">
                              <div className="admin-cell-primary">Semana {idx + 1}</div>
                              <div className="admin-cell-secondary">
                                {formatearFechaCorta(w.semana_inicio)} – {formatearFechaCorta(w.semana_fin)}
                              </div>
                            </td>
                            <td data-label="Programadas">
                              <strong>{w.total_programadas}</strong>
                            </td>
                            <td data-label="No asistió">
                              <span className="admin-badge admin-badge--no-show">{w.total_no_asistio}</span>
                            </td>
                            <td data-label="Confirmadas">{w.confirmadas}</td>
                            <td data-label="Atendidas">{w.atendidas}</td>
                            <td data-label="Canceladas">{w.canceladas}</td>
                            <td data-label="Tasa Semanal" className="admin-kpi-rate-cell">
                              <div className="admin-kpi-rate-wrap">
                                <div className="admin-kpi-bar-track" aria-hidden="true">
                                  <div
                                    className={`admin-kpi-bar-fill ${sev}`}
                                    style={{ width: `${Math.min(100, Number(w.tasa_inasistencia_pct) || 0)}%` }}
                                  />
                                </div>
                                <strong className={`admin-kpi-rate-val ${sev}`}>
                                  {formatPct(w.tasa_inasistencia_pct)}
                                </strong>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Vista Mensual */}
            {vistaInasistencia === 'mensual' && (
              seriesMensual.length === 0 ? (
                <div className="admin-empty-state">
                  <span className="material-symbols-outlined" aria-hidden="true">event_busy</span>
                  <p>No hay citas registradas en el período seleccionado.</p>
                </div>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th>Citas Programadas</th>
                        <th>No asistió</th>
                        <th>Confirmadas</th>
                        <th>Atendidas</th>
                        <th>Canceladas</th>
                        <th>Tasa Inasistencia Mensual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seriesMensual.map((m) => {
                        const sev = getSeverityClass(m.tasa_inasistencia_pct);
                        return (
                          <tr key={m.mes} className="admin-table-row">
                            <td data-label="Mes">
                              <div className="admin-cell-primary">{formatearMes(m.mes)}</div>
                              <div className="admin-cell-secondary">{m.mes}</div>
                            </td>
                            <td data-label="Programadas"><strong>{m.total_programadas}</strong></td>
                            <td data-label="No asistió">
                              <span className="admin-badge admin-badge--no-show">{m.total_no_asistio}</span>
                            </td>
                            <td data-label="Confirmadas">{m.confirmadas}</td>
                            <td data-label="Atendidas">{m.atendidas}</td>
                            <td data-label="Canceladas">{m.canceladas}</td>
                            <td data-label="Tasa Mensual" className="admin-kpi-rate-cell">
                              <div className="admin-kpi-rate-wrap">
                                <div className="admin-kpi-bar-track" aria-hidden="true">
                                  <div
                                    className={`admin-kpi-bar-fill ${sev}`}
                                    style={{ width: `${Math.min(100, Number(m.tasa_inasistencia_pct) || 0)}%` }}
                                  />
                                </div>
                                <strong className={`admin-kpi-rate-val ${sev}`}>
                                  {formatPct(m.tasa_inasistencia_pct)}
                                </strong>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Vista Diaria */}
            {vistaInasistencia === 'diaria' && (
              seriesDiaria.length === 0 ? (
                <div className="admin-empty-state">
                  <span className="material-symbols-outlined" aria-hidden="true">event_busy</span>
                  <p>No hay citas registradas en el período seleccionado.</p>
                </div>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Programadas</th>
                        <th>No asistió</th>
                        <th>Confirmadas</th>
                        <th>Atendidas</th>
                        <th>Tasa Diaria</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seriesDiaria.map((d) => {
                        const sev = getSeverityClass(d.tasa_inasistencia_pct);
                        return (
                          <tr key={d.fecha} className="admin-table-row">
                            <td data-label="Fecha">
                              <div className="admin-cell-primary" style={{ textTransform: 'capitalize' }}>
                                {formatearFechaDia(d.fecha)}
                              </div>
                              <div className="admin-cell-secondary">{d.fecha}</div>
                            </td>
                            <td data-label="Programadas"><strong>{d.total_programadas}</strong></td>
                            <td data-label="No asistió">
                              {d.total_no_asistio > 0 ? (
                                <span className="admin-badge admin-badge--no-show">{d.total_no_asistio}</span>
                              ) : (
                                <span className="admin-cell-secondary">0</span>
                              )}
                            </td>
                            <td data-label="Confirmadas">{d.confirmadas}</td>
                            <td data-label="Atendidas">{d.atendidas}</td>
                            <td data-label="Tasa Diaria" className="admin-kpi-rate-cell">
                              <div className="admin-kpi-rate-wrap">
                                <div className="admin-kpi-bar-track" aria-hidden="true">
                                  <div
                                    className={`admin-kpi-bar-fill ${sev}`}
                                    style={{ width: `${Math.min(100, Number(d.tasa_inasistencia_pct) || 0)}%` }}
                                  />
                                </div>
                                <strong className={`admin-kpi-rate-val ${sev}`}>
                                  {formatPct(d.tasa_inasistencia_pct)}
                                </strong>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </section>

          {/* BLOQUE 3: Rendimiento del Chatbot fuera de horario laboral */}
          <div className="admin-kpis-bottom-grid">
            <section className="admin-kpi-panel" aria-labelledby="kpi-chatbot-horario-heading">
              <div className="admin-kpi-panel-header">
                <div>
                  <h2 id="kpi-chatbot-horario-heading" className="admin-kpi-panel-title">
                    Actividad del Chatbot por Hora del Día (Chile)
                  </h2>
                  <p className="admin-kpi-panel-subtitle">
                    Horario laboral configurado: <strong>{horarioResumenTexto}</strong>
                  </p>
                </div>
              </div>

              {/* Barra comparativa Fuera de horario vs Horario laboral */}
              <div className="admin-kpi-split-box">
                <div className="admin-kpi-split-labels">
                  <span>
                    <strong className="admin-kpi-dot admin-kpi-dot--off" /> Fuera de horario:{' '}
                    <strong>{chatbot.conversaciones_fuera_horario ?? 0}</strong> conv. (
                    {formatPct(chatbot.pct_conversaciones_fuera_horario)})
                  </span>
                  <span>
                    <strong className="admin-kpi-dot admin-kpi-dot--on" /> En horario:{' '}
                    <strong>{chatbot.conversaciones_en_horario ?? 0}</strong> conv.
                  </span>
                </div>
                <div className="admin-kpi-split-track" role="img" aria-label="Proporción de conversaciones fuera de horario laboral">
                  <div
                    className="admin-kpi-split-off"
                    style={{ width: `${Math.min(100, Number(chatbot.pct_conversaciones_fuera_horario) || 0)}%` }}
                  />
                </div>
              </div>

              {/* Histograma 00h - 23h */}
              <div className="admin-kpi-hours-chart" aria-label="Distribución de interacciones del chatbot por hora">
                {(chatbot.distribucion_por_hora || []).map((h) => {
                  const pctTotal = Math.round(((Number(h.total) || 0) / maxPorHora) * 100);
                  const esFuera = Number(h.fuera_horario) > 0 && Number(h.en_horario) === 0;
                  const mixto = Number(h.fuera_horario) > 0 && Number(h.en_horario) > 0;
                  const hh = String(h.hora).padStart(2, '0');
                  return (
                    <div
                      key={h.hora}
                      className="admin-kpi-hour-col"
                      title={`${hh}:00 hrs — ${h.total} interacciones (${h.fuera_horario} fuera de horario, ${h.en_horario} en horario)`}
                    >
                      <div className="admin-kpi-hour-bar-wrap">
                        <div
                          className={`admin-kpi-hour-bar ${
                            esFuera ? 'is-off' : mixto ? 'is-mixed' : 'is-on'
                          }`}
                          style={{ height: `${h.total > 0 ? Math.max(10, pctTotal) : 0}%` }}
                        />
                      </div>
                      <span className="admin-kpi-hour-label">{hh}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Top Categorías consultadas fuera de horario */}
            <section className="admin-kpi-panel" aria-labelledby="kpi-chatbot-cats-heading">
              <div className="admin-kpi-panel-header">
                <div>
                  <h2 id="kpi-chatbot-cats-heading" className="admin-kpi-panel-title">
                    Temas Consultados Fuera de Horario
                  </h2>
                  <p className="admin-kpi-panel-subtitle">
                    Categorías más demandadas cuando el salón está cerrado.
                  </p>
                </div>
              </div>

              {(chatbot.top_categorias_fuera_horario || []).length === 0 ? (
                <div className="admin-empty-state" style={{ padding: '2rem 1rem' }}>
                  <span className="material-symbols-outlined" aria-hidden="true">dark_mode</span>
                  <p>Sin conversaciones fuera de horario en el período seleccionado.</p>
                </div>
              ) : (
                <ul className="admin-kpi-cat-list">
                  {chatbot.top_categorias_fuera_horario.map((item) => {
                    const base = Math.max(1, Number(chatbot.conversaciones_fuera_horario) || 1);
                    const pct = Math.min(100, Math.round((Number(item.total) / base) * 100));
                    return (
                      <li key={item.categoria} className="admin-kpi-cat-item">
                        <div className="admin-kpi-cat-row">
                          <span className="admin-cell-primary">
                            {CATEGORIAS_LABELS[item.categoria] || item.categoria}
                          </span>
                          <span className="admin-cell-secondary">
                            <strong>{item.total}</strong> ({pct}%)
                          </span>
                        </div>
                        <div className="admin-kpi-bar-track" aria-hidden="true">
                          <div className="admin-kpi-bar-fill is-off" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {source && (
                <div className="admin-kpi-source-foot">
                  Fuente de cálculo: <code>{source}</code>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

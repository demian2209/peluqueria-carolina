'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authHeaders } from '../services/authService';
import {
  getEstilistas,
  getBloqueosAdmin,
  crearBloqueoAdmin,
  actualizarBloqueoAdmin,
  eliminarBloqueoAdmin,
  obtenerFechaHoraSistemaCliente,
  obtenerHorariosCanónicosEstilistas,
  resolverClaveEstilistaPublica,
} from '../services/api';

const DIAS_SEMANA = [
  { id: 1, corto: 'Lun', largo: 'Lunes' },
  { id: 2, corto: 'Mar', largo: 'Martes' },
  { id: 3, corto: 'Mié', largo: 'Miércoles' },
  { id: 4, corto: 'Jue', largo: 'Jueves' },
  { id: 5, corto: 'Vie', largo: 'Viernes' },
  { id: 6, corto: 'Sáb', largo: 'Sábado' },
  { id: 0, corto: 'Dom', largo: 'Domingo' },
];

const MOTIVOS_SUGERIDOS = [
  'Colación / Almuerzo',
  'Feriado',
  'Capacitación',
  'Cierre excepcional',
  'Trámite personal',
];

const PRESETS_HORARIOS = [
  { label: 'Colación (13:00–14:00)', inicio: '13:00', fin: '14:00' },
  { label: 'Mañana (09:00–13:00)', inicio: '09:00', fin: '13:00' },
  { label: 'Tarde (14:00–19:00)', inicio: '14:00', fin: '19:00' },
];

const getNombreDia = (diaNum) => {
  const found = DIAS_SEMANA.find((d) => d.id === Number(diaNum));
  return found ? found.largo : `Día ${diaNum}`;
};

const getDiaSemanaDeFecha = (fechaStr) => {
  if (!fechaStr || !/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return null;
  const [y, m, d] = fechaStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const timeToMin = (t) => {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return h * 60 + m;
};

export default function AdminBloqueosHorarios() {
  const [bloqueos, setBloqueos] = useState([]);
  const [estilistas, setEstilistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Filtros de tabla
  const [filtroEstilista, setFiltroEstilista] = useState('all');
  const [filtroTipo, setFiltroTipo] = useState('all');
  const [filtroEstado, setFiltroEstado] = useState('activos');

  // Estado del formulario de creación (fechaHoy hidratada solo en cliente para evitar desfase SSR/SSG)
  const [fechaHoy, setFechaHoy] = useState('');
  const [estilistaId, setEstilistaId] = useState('todos');
  const [tipo, setTipo] = useState('fecha'); // 'fecha' | 'recurrente'
  const [fecha, setFecha] = useState('');

  useEffect(() => {
    const { fechaHoy: hoy } = obtenerFechaHoraSistemaCliente();
    setFechaHoy(hoy);
    setFecha((prev) => prev || hoy);
  }, []);
  const [diaSemana, setDiaSemana] = useState(1);
  const [diaCompleto, setDiaCompleto] = useState(false);
  const [horaInicio, setHoraInicio] = useState('13:00');
  const [horaFin, setHoraFin] = useState('14:00');
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Acciones por fila
  const [procesandoId, setProcesandoId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const horariosCanonicos = useMemo(() => obtenerHorariosCanónicosEstilistas(), []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [blqData, estData] = await Promise.all([
        getBloqueosAdmin(authHeaders()),
        getEstilistas(),
      ]);
      setBloqueos(Array.isArray(blqData) ? blqData : []);
      setEstilistas(Array.isArray(estData) ? estData : []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los bloqueos horarios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [blqData, estData] = await Promise.all([
          getBloqueosAdmin(authHeaders()),
          getEstilistas(),
        ]);
        if (!active) return;
        setBloqueos(Array.isArray(blqData) ? blqData : []);
        setEstilistas(Array.isArray(estData) ? estData : []);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'No se pudieron cargar los bloqueos horarios.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Lista normalizada de estilistas para selectores y etiquetas
  const estilistasNormalizados = useMemo(() => {
    return estilistas.map((e) => {
      const nombreCompleto = [e.nombre, e.apellido]
        .filter(Boolean)
        .join(' ')
        .replace(/\b(\w+)\s+\1\b/i, '$1')
        .trim();
      const canonicalKey = resolverClaveEstilistaPublica(e.id, nombreCompleto);
      const horario = horariosCanonicos[canonicalKey] || {
        dias: [1, 2, 3, 4, 5, 6],
        hora_inicio: '09:00',
        hora_fin: '19:00',
        diasAtencionTexto: 'Lunes a Sábado (09:00 a 19:00 hs)',
      };
      return {
        canonicalKey,
        nombreCompleto: nombreCompleto || horario.nombre || String(e.id),
        dias: horario.dias,
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
        diasAtencionTexto: horario.diasAtencionTexto,
      };
    });
  }, [estilistas, horariosCanonicos]);

  // Información de atención del alcance actualmente seleccionado en el formulario
  const alcanceHorarioInfo = useMemo(() => {
    if (estilistaId === 'todos') {
      return {
        nombre: 'Todo el Salón',
        dias: [0, 1, 2, 3, 4, 5, 6],
        hora_inicio: '09:00',
        hora_fin: '19:00',
        diasAtencionTexto: 'Todos los días con atención en salón (09:00 a 19:00 hs)',
      };
    }
    const found = estilistasNormalizados.find((e) => e.canonicalKey === estilistaId);
    if (found) {
      return {
        nombre: found.nombreCompleto,
        dias: found.dias,
        hora_inicio: found.hora_inicio,
        hora_fin: found.hora_fin,
        diasAtencionTexto: found.diasAtencionTexto,
      };
    }
    const fallback = horariosCanonicos[estilistaId];
    return fallback
      ? {
          nombre: fallback.nombre,
          dias: fallback.dias,
          hora_inicio: fallback.hora_inicio,
          hora_fin: fallback.hora_fin,
          diasAtencionTexto: fallback.diasAtencionTexto,
        }
      : {
          nombre: estilistaId,
          dias: [1, 2, 3, 4, 5, 6],
          hora_inicio: '09:00',
          hora_fin: '19:00',
          diasAtencionTexto: 'Lunes a Sábado (09:00 a 19:00 hs)',
        };
  }, [estilistaId, estilistasNormalizados, horariosCanonicos]);

  // Advertencia si en modo "fecha específica" el estilista ya no atiende ese día de la semana
  const advertenciaDiaSinAtencion = useMemo(() => {
    if (tipo !== 'fecha' || !fecha || estilistaId === 'todos') return '';
    const dSem = getDiaSemanaDeFecha(fecha);
    if (dSem === null) return '';
    if (!alcanceHorarioInfo.dias.includes(dSem)) {
      return `${alcanceHorarioInfo.nombre} habitualmente no atiende los días ${getNombreDia(dSem).toLowerCase()}.`;
    }
    return '';
  }, [tipo, fecha, estilistaId, alcanceHorarioInfo]);

  const handleEstilistaChange = (newEstId) => {
    setEstilistaId(newEstId);
    setFormError('');
    if (newEstId !== 'todos') {
      const cfg =
        estilistasNormalizados.find((e) => e.canonicalKey === newEstId) ||
        horariosCanonicos[newEstId];
      if (cfg && Array.isArray(cfg.dias) && !cfg.dias.includes(diaSemana)) {
        setDiaSemana(cfg.dias[0] ?? 1);
      }
    }
  };

  const getNombreEstilistaPorId = useCallback(
    (id) => {
      if (!id || id === 'todos') return 'Todo el Salón';
      const found = estilistasNormalizados.find((e) => e.canonicalKey === id);
      if (found) return found.nombreCompleto;
      if (horariosCanonicos[id]) return horariosCanonicos[id].nombre;
      return id;
    },
    [estilistasNormalizados, horariosCanonicos]
  );

  const handleCrearBloqueo = async (e) => {
    e.preventDefault();
    setFormError('');
    setFeedback('');

    if (tipo === 'fecha') {
      if (!fecha) {
        setFormError('Selecciona una fecha para el bloqueo.');
        return;
      }
      if (fecha < fechaHoy) {
        setFormError('No puedes crear un bloqueo en una fecha pasada.');
        return;
      }
    }

    if (!diaCompleto) {
      if (!horaInicio || !horaFin) {
        setFormError('Debes indicar hora de inicio y hora de fin.');
        return;
      }
      if (timeToMin(horaFin) <= timeToMin(horaInicio)) {
        setFormError('La hora de fin debe ser posterior a la hora de inicio.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        estilista_id: estilistaId,
        tipo,
        ...(tipo === 'fecha' ? { fecha } : { dia_semana: Number(diaSemana) }),
        dia_completo: diaCompleto,
        ...(diaCompleto ? {} : { hora_inicio: horaInicio, hora_fin: horaFin }),
        motivo: motivo.trim(),
        activo: true,
      };

      const creado = await crearBloqueoAdmin(payload, authHeaders());
      setBloqueos((prev) => [creado, ...prev.filter((b) => String(b.id) !== String(creado.id))]);
      setMotivo('');
      setFeedback(
        'Bloqueo guardado y sincronizado. El formulario público de reservas ya refleja esta restricción.'
      );
    } catch (err) {
      setFormError(err.message || 'No se pudo guardar el bloqueo horario.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActivo = async (bloqueo) => {
    setProcesandoId(bloqueo.id);
    setError('');
    setFeedback('');
    try {
      const actualizado = await actualizarBloqueoAdmin(
        bloqueo.id,
        { activo: !bloqueo.activo },
        authHeaders()
      );
      setBloqueos((prev) =>
        prev.map((item) => (String(item.id) === String(bloqueo.id) ? actualizado : item))
      );
      setFeedback(
        actualizado.activo
          ? 'Bloqueo reactivado en el formulario de reservas.'
          : 'Bloqueo pausado. Esos horarios volvieron a estar disponibles.'
      );
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado del bloqueo.');
    } finally {
      setProcesandoId(null);
    }
  };

  const handleEliminar = async (id) => {
    setProcesandoId(id);
    setError('');
    setFeedback('');
    try {
      await eliminarBloqueoAdmin(id, authHeaders());
      setBloqueos((prev) => prev.filter((item) => String(item.id) !== String(id)));
      setConfirmDeleteId(null);
      setFeedback('Bloqueo eliminado y disponibilidad liberada en el sitio público.');
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el bloqueo.');
    } finally {
      setProcesandoId(null);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const activos = bloqueos.filter((b) => b.activo);
    return {
      totalActivos: activos.length,
      diasCompletos: activos.filter((b) => b.dia_completo).length,
      recurrentes: activos.filter((b) => b.tipo === 'recurrente').length,
      puntuales: activos.filter((b) => b.tipo === 'fecha').length,
    };
  }, [bloqueos]);

  // Lista filtrada
  const bloqueosFiltrados = useMemo(() => {
    return bloqueos.filter((b) => {
      if (filtroEstilista !== 'all' && b.estilista_id !== filtroEstilista) return false;
      if (filtroTipo !== 'all' && b.tipo !== filtroTipo) return false;
      if (filtroEstado === 'activos' && !b.activo) return false;
      if (filtroEstado === 'inactivos' && b.activo) return false;
      return true;
    });
  }, [bloqueos, filtroEstilista, filtroTipo, filtroEstado]);

  return (
    <div className="admin-bloqueos-container">
      {/* KPIs */}
      <div className="admin-stats-grid" aria-label="Resumen de bloqueos horarios">
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--danger">
            <span className="material-symbols-outlined" aria-hidden="true">event_busy</span>
          </div>
          <div>
            <div className="admin-stat-value">{stats.totalActivos}</div>
            <div className="admin-stat-label">Bloqueos Activos</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--warning">
            <span className="material-symbols-outlined" aria-hidden="true">block</span>
          </div>
          <div>
            <div className="admin-stat-value">{stats.diasCompletos}</div>
            <div className="admin-stat-label">Días Completos</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--info">
            <span className="material-symbols-outlined" aria-hidden="true">repeat</span>
          </div>
          <div>
            <div className="admin-stat-value">{stats.recurrentes}</div>
            <div className="admin-stat-label">Recurrentes Semanales</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--success">
            <span className="material-symbols-outlined" aria-hidden="true">today</span>
          </div>
          <div>
            <div className="admin-stat-value">{stats.puntuales}</div>
            <div className="admin-stat-label">Fechas Específicas</div>
          </div>
        </div>
      </div>

      {/* Mensajes globales */}
      {feedback && (
        <div className="admin-bloqueos-banner admin-bloqueos-banner--success" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
          <span>{feedback}</span>
          <button
            type="button"
            className="admin-bloqueos-banner-close"
            onClick={() => setFeedback('')}
            aria-label="Cerrar notificación"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {error && (
        <div className="admin-bloqueos-banner admin-bloqueos-banner--error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>{error}</span>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={cargarDatos}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Grid principal: Formulario a la izquierda + Lista a la derecha */}
      <div className="admin-bloqueos-grid">
        {/* Formulario de Nuevo Bloqueo */}
        <section className="admin-bloqueos-card" aria-labelledby="titulo-nuevo-bloqueo">
          <div className="admin-bloqueos-card-header">
            <span className="material-symbols-outlined" aria-hidden="true">lock_clock</span>
            <div>
              <h2 id="titulo-nuevo-bloqueo" className="admin-bloqueos-card-title">
                Nuevo Bloqueo de Horario
              </h2>
              <p className="admin-bloqueos-card-subtitle">
                Restringe horas o días completos según la jornada de atención.
              </p>
            </div>
          </div>

          <form onSubmit={handleCrearBloqueo} className="admin-bloqueos-form" noValidate>
            {/* 1. Alcance: Todo el salón o Estilista */}
            <div className="admin-form-group">
              <label htmlFor="bloqueo-estilista" className="admin-form-label">
                Aplicar a
              </label>
              <select
                id="bloqueo-estilista"
                className="admin-form-input"
                value={estilistaId}
                onChange={(e) => handleEstilistaChange(e.target.value)}
              >
                <option value="todos">Todo el Salón (todos los estilistas)</option>
                {estilistasNormalizados.map((est) => (
                  <option key={est.canonicalKey} value={est.canonicalKey}>
                    {est.nombreCompleto}
                  </option>
                ))}
              </select>
            </div>

            {/* Tarjeta informativa de días y horario de atención del alcance */}
            <div className="admin-bloqueos-schedule-ref" aria-live="polite">
              <div className="admin-bloqueos-schedule-ref-title">
                <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                <span>Jornada de atención: {alcanceHorarioInfo.diasAtencionTexto}</span>
              </div>
              <div className="admin-bloqueos-days-strip" aria-label="Días que atiende">
                {DIAS_SEMANA.map((d) => {
                  const atiende = alcanceHorarioInfo.dias.includes(d.id);
                  return (
                    <span
                      key={d.id}
                      className={`admin-bloqueos-day-pill ${atiende ? 'is-working' : 'is-off'}`}
                      title={atiende ? `${d.largo}: Atiende` : `${d.largo}: No atiende`}
                    >
                      {d.corto}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 2. Tipo de Bloqueo */}
            <fieldset className="admin-bloqueos-fieldset">
              <legend className="admin-form-label">Tipo de Bloqueo</legend>
              <div className="admin-bloqueos-segmented">
                <button
                  type="button"
                  className={`admin-bloqueos-seg-btn ${tipo === 'fecha' ? 'is-active' : ''}`}
                  onClick={() => {
                    setTipo('fecha');
                    setFormError('');
                  }}
                  aria-pressed={tipo === 'fecha'}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">today</span>
                  <span>Fecha específica</span>
                </button>
                <button
                  type="button"
                  className={`admin-bloqueos-seg-btn ${tipo === 'recurrente' ? 'is-active' : ''}`}
                  onClick={() => {
                    setTipo('recurrente');
                    setFormError('');
                  }}
                  aria-pressed={tipo === 'recurrente'}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">repeat</span>
                  <span>Recurrente semanal</span>
                </button>
              </div>
            </fieldset>

            {/* 3. Selector de Fecha o Día de la Semana */}
            {tipo === 'fecha' ? (
              <div className="admin-form-group">
                <label htmlFor="bloqueo-fecha" className="admin-form-label">
                  Fecha a bloquear
                </label>
                <input
                  id="bloqueo-fecha"
                  type="date"
                  className="admin-form-input admin-form-input--date"
                  min={fechaHoy}
                  value={fecha}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    setFormError('');
                  }}
                  required
                />
                {advertenciaDiaSinAtencion && (
                  <p className="admin-bloqueos-hint admin-bloqueos-hint--warn">
                    <span className="material-symbols-outlined" aria-hidden="true">info</span>
                    <span>{advertenciaDiaSinAtencion}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="admin-form-group">
                <span className="admin-form-label">Día de atención a bloquear cada semana</span>
                <div className="admin-bloqueos-weekday-grid" role="group" aria-label="Seleccionar día de la semana">
                  {DIAS_SEMANA.map((d) => {
                    const atiende = alcanceHorarioInfo.dias.includes(d.id);
                    const selected = Number(diaSemana) === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        disabled={!atiende}
                        className={`admin-bloqueos-weekday-btn ${selected ? 'is-selected' : ''} ${!atiende ? 'is-disabled' : ''}`}
                        onClick={() => setDiaSemana(d.id)}
                        aria-pressed={selected}
                        title={atiende ? `Bloquear todos los ${d.largo}` : `${alcanceHorarioInfo.nombre} no atiende los ${d.largo}`}
                      >
                        <strong>{d.corto}</strong>
                        <span>{atiende ? 'Atiende' : 'Libre'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Modalidad: Día completo vs Rango horario */}
            <div className="admin-form-group">
              <label className="admin-bloqueos-checkbox-label">
                <input
                  type="checkbox"
                  checked={diaCompleto}
                  onChange={(e) => {
                    setDiaCompleto(e.target.checked);
                    setFormError('');
                  }}
                />
                <span>Bloquear día completo (sin atención en ningún bloque)</span>
              </label>
            </div>

            {!diaCompleto && (
              <div className="admin-bloqueos-time-box">
                <div className="admin-bloqueos-time-row">
                  <div className="admin-form-group">
                    <label htmlFor="bloqueo-hora-inicio" className="admin-form-label">
                      Desde
                    </label>
                    <input
                      id="bloqueo-hora-inicio"
                      type="time"
                      className="admin-form-input"
                      value={horaInicio}
                      onChange={(e) => {
                        setHoraInicio(e.target.value);
                        setFormError('');
                      }}
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label htmlFor="bloqueo-hora-fin" className="admin-form-label">
                      Hasta
                    </label>
                    <input
                      id="bloqueo-hora-fin"
                      type="time"
                      className="admin-form-input"
                      value={horaFin}
                      onChange={(e) => {
                        setHoraFin(e.target.value);
                        setFormError('');
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="admin-bloqueos-presets" aria-label="Rangos rápidos">
                  {PRESETS_HORARIOS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="admin-bloqueos-chip"
                      onClick={() => {
                        setHoraInicio(preset.inicio);
                        setHoraFin(preset.fin);
                        setFormError('');
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Motivo */}
            <div className="admin-form-group">
              <label htmlFor="bloqueo-motivo" className="admin-form-label">
                Motivo (visible para administración y bloqueos de día completo)
              </label>
              <input
                id="bloqueo-motivo"
                type="text"
                className="admin-form-input"
                maxLength={180}
                placeholder="Ej. Almuerzo, Feriado, Capacitación..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <div className="admin-bloqueos-presets">
                {MOTIVOS_SUGERIDOS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    className="admin-bloqueos-chip"
                    onClick={() => setMotivo(sug)}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {formError && (
              <div className="admin-bloqueos-form-error" role="alert">
                <span className="material-symbols-outlined" aria-hidden="true">error</span>
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              id="btn-crear-bloqueo"
              className="admin-btn admin-btn--primary admin-bloqueos-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="admin-btn-spinner admin-btn-spinner--sm" />
                  <span>Guardando bloqueo...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                  <span>Bloquear Horario</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Listado de Bloqueos Configurados */}
        <section className="admin-bloqueos-card" aria-labelledby="titulo-lista-bloqueos">
          <div className="admin-bloqueos-list-header">
            <div>
              <h2 id="titulo-lista-bloqueos" className="admin-bloqueos-card-title">
                Bloqueos Configurados ({bloqueosFiltrados.length})
              </h2>
              <p className="admin-bloqueos-card-subtitle">
                Los bloqueos activos ocultan automáticamente esos horarios en la página principal.
              </p>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={cargarDatos}
              disabled={loading}
              title="Actualizar lista"
            >
              <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
              <span>Actualizar</span>
            </button>
          </div>

          {/* Filtros */}
          <div className="admin-bloqueos-filters">
            <select
              aria-label="Filtrar por estilista"
              className="admin-form-input"
              value={filtroEstilista}
              onChange={(e) => setFiltroEstilista(e.target.value)}
            >
              <option value="all">Todos los alcances</option>
              <option value="todos">Solo Todo el Salón</option>
              {estilistasNormalizados.map((est) => (
                <option key={est.canonicalKey} value={est.canonicalKey}>
                  {est.nombreCompleto}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por tipo"
              className="admin-form-input"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="all">Todos los tipos</option>
              <option value="fecha">Fecha específica</option>
              <option value="recurrente">Recurrente semanal</option>
            </select>

            <select
              aria-label="Filtrar por estado"
              className="admin-form-input"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="activos">Solo activos</option>
              <option value="all">Todos</option>
              <option value="inactivos">Pausados</option>
            </select>
          </div>

          {/* Estados de contenido */}
          {loading ? (
            <div className="admin-bloqueos-empty" role="status">
              <span className="admin-spinner" />
              <p>Cargando bloqueos horarios...</p>
            </div>
          ) : bloqueosFiltrados.length === 0 ? (
            <div className="admin-bloqueos-empty">
              <span className="material-symbols-outlined" aria-hidden="true">event_available</span>
              <h3>Sin bloqueos en esta vista</h3>
              <p>
                Todos los horarios de atención están abiertos para reservas según la jornada habitual.
              </p>
            </div>
          ) : (
            <ul className="admin-bloqueos-list">
              {bloqueosFiltrados.map((b) => {
                const isBusy = procesandoId === b.id;
                const isConfirmingDelete = confirmDeleteId === b.id;
                return (
                  <li
                    key={b.id}
                    className={`admin-bloqueo-item ${!b.activo ? 'admin-bloqueo-item--paused' : ''}`}
                  >
                    <div className="admin-bloqueo-item-main">
                      <div className="admin-bloqueo-item-badges">
                        <span
                          className={`admin-bloqueo-badge ${
                            b.tipo === 'recurrente'
                              ? 'admin-bloqueo-badge--recurrente'
                              : 'admin-bloqueo-badge--fecha'
                          }`}
                        >
                          {b.tipo === 'recurrente' ? 'Recurrente' : 'Fecha puntual'}
                        </span>
                        <span
                          className={`admin-bloqueo-badge ${
                            b.activo
                              ? 'admin-bloqueo-badge--activo'
                              : 'admin-bloqueo-badge--pausado'
                          }`}
                        >
                          {b.activo ? 'Activo' : 'Pausado'}
                        </span>
                        <span className="admin-bloqueo-scope">
                          {getNombreEstilistaPorId(b.estilista_id)}
                        </span>
                      </div>

                      <div className="admin-bloqueo-item-when">
                        <strong>
                          {b.tipo === 'fecha'
                            ? b.fecha
                            : `Todos los ${getNombreDia(b.dia_semana)}`}
                        </strong>
                        <span className="admin-bloqueo-item-hours">
                          {b.dia_completo
                            ? 'Día completo'
                            : `${b.hora_inicio} – ${b.hora_fin} hs`}
                        </span>
                      </div>

                      {b.motivo && (
                        <p className="admin-bloqueo-item-motivo">
                          <span className="material-symbols-outlined" aria-hidden="true">notes</span>
                          <span>{b.motivo}</span>
                        </p>
                      )}
                    </div>

                    <div className="admin-bloqueo-item-actions">
                      {isConfirmingDelete ? (
                        <div className="admin-bloqueo-confirm-delete">
                          <span>¿Eliminar?</span>
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger"
                            onClick={() => handleEliminar(b.id)}
                            disabled={isBusy}
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isBusy}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            onClick={() => handleToggleActivo(b)}
                            disabled={isBusy}
                            title={b.activo ? 'Pausar bloqueo' : 'Reactivar bloqueo'}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              {b.activo ? 'pause_circle' : 'play_circle'}
                            </span>
                            <span>{b.activo ? 'Pausar' : 'Activar'}</span>
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger-ghost"
                            onClick={() => setConfirmDeleteId(b.id)}
                            disabled={isBusy}
                            aria-label="Eliminar bloqueo"
                            title="Eliminar bloqueo"
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

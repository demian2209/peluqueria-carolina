'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { authHeaders } from '../services/authService';
import {
  getEstilistasAdmin,
  crearEstilistaAdmin,
  actualizarEstilistaAdmin,
  toggleVisibilidadEstilistaAdmin,
  eliminarEstilistaAdmin,
  getServiciosAdmin,
} from '../services/api';

const NIVELES_CONFIG = {
  master:  { label: 'Master Stylist',  icon: 'workspace_premium', color: 'warning' },
  senior:  { label: 'Senior Stylist',  icon: 'star',              color: 'info'    },
  artisan: { label: 'Artisan Barber',  icon: 'content_cut',       color: 'success' },
};

const GALERIA_RETRATOS = [
  { label: 'Carolina Valenzuela', url: '/images/maestros_tijera/carolina_valenzuela.webp' },
  { label: 'Matías Muñoz',        url: '/images/maestros_tijera/matias_munoz.webp' },
  { label: 'Camila Soto',         url: '/images/maestros_tijera/camila_soto.webp' },
  { label: 'Gonzalo Riquelme',    url: '/images/maestros_tijera/gonzalo_riquelme.webp' },
  { label: 'Valentina Morales',   url: '/images/maestros_tijera/valentina_morales.webp' },
];

const INITIAL_FORM = {
  nombre: '',
  apellido: '',
  especialidad: '',
  bio: '',
  nivel: 'senior',
  orden: 1,
  foto_url: '/images/maestros_tijera/carolina_valenzuela.webp',
  imagen_base64: '',
  activo: true,
  servicios_ids: [],
};

/**
 * Optimiza y redimensiona una fotografía de retrato en el navegador (máx 900x1200, WebP/JPEG)
 * para mantener proporción 3:4 y tiempos de carga rápidos.
 */
function optimizarImagenRetrato(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen válido (JPG, PNG, WebP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'));
      img.onload = () => {
        const maxWidth = 900;
        const maxHeight = 1200;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', 0.86);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        }
        resolve(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function getFullName(member) {
  const nombre = String(member?.nombre || '').trim();
  const apellido = String(member?.apellido || '').trim();
  if (!apellido) return nombre;
  return nombre.toLowerCase().includes(apellido.toLowerCase())
    ? nombre
    : `${nombre} ${apellido}`.trim();
}

export default function AdminEquipoList() {
  const [estilistas, setEstilistas] = useState([]);
  const [serviciosCatalogo, setServiciosCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState('');

  // Filtros
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroVisibilidad, setFiltroVisibilidad] = useState('');

  // Estado de acción por fila
  const [procesandoId, setProcesandoId] = useState(null);

  // Modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('crear'); // 'crear' | 'editar'
  const [editandoId, setEditandoId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [guardandoModal, setGuardandoModal] = useState(false);
  const [arrastrandoImagen, setArrastrandoImagen] = useState(false);
  const fileInputRef = useRef(null);

  // Modal confirmación eliminar
  const [miembroAEliminar, setMiembroAEliminar] = useState(null);
  const [eliminarError, setEliminarError] = useState('');

  const mostrarFeedback = useCallback((msg) => {
    setFeedbackBanner(msg);
    const timer = setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? '' : prev));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = authHeaders();
      const [estData, svcData] = await Promise.all([
        getEstilistasAdmin(headers),
        getServiciosAdmin(headers).catch(() => []),
      ]);
      const ordenados = [...(estData || [])].sort(
        (a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99)
      );
      setEstilistas(ordenados);
      if (Array.isArray(svcData)) {
        setServiciosCatalogo(svcData);
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar el equipo de profesionales.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initLoad = async () => {
      if (active) await cargarDatos();
    };
    initLoad();
    return () => {
      active = false;
    };
  }, [cargarDatos]);

  // Cerrar modales con Escape
  useEffect(() => {
    if (!modalAbierto && !miembroAEliminar) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !guardandoModal && !procesandoId) {
        if (modalAbierto) {
          setModalAbierto(false);
          setFormError('');
        }
        if (miembroAEliminar) {
          setMiembroAEliminar(null);
          setEliminarError('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalAbierto, miembroAEliminar, guardandoModal, procesandoId]);

  // Toggle rápido de visibilidad (activo)
  const handleToggleVisibilidad = async (miembro) => {
    const id = miembro.id;
    const nuevoValor = !miembro.activo;
    setProcesandoId(id);
    setError('');

    // Actualización optimista
    setEstilistas((prev) =>
      prev.map((e) => (e.id === id ? { ...e, activo: nuevoValor } : e))
    );

    try {
      const actualizado = await toggleVisibilidadEstilistaAdmin(
        id,
        { activo: nuevoValor },
        authHeaders()
      );
      if (actualizado) {
        setEstilistas((prev) =>
          prev.map((e) => (e.id === id ? { ...e, ...actualizado } : e))
        );
      }
      const fullName = getFullName(miembro);
      mostrarFeedback(
        `"${fullName}" ahora está ${nuevoValor ? 'visible en Maestros de la Tijera & Color y Reservas' : 'oculto del sitio público'}.`
      );
    } catch (err) {
      setEstilistas((prev) =>
        prev.map((e) => (e.id === id ? { ...e, activo: !nuevoValor } : e))
      );
      setError(err.message || 'Error al actualizar la visibilidad del profesional.');
    } finally {
      setProcesandoId(null);
    }
  };

  // Cambio rápido de orden
  const handleCambiarOrden = async (miembro, direccion) => {
    const id = miembro.id;
    const nuevoOrden = Math.max(1, Number(miembro.orden || 1) + direccion);
    if (nuevoOrden === Number(miembro.orden)) return;

    setProcesandoId(id);
    setError('');
    try {
      const actualizado = await actualizarEstilistaAdmin(
        id,
        { orden: nuevoOrden },
        authHeaders()
      );
      setEstilistas((prev) =>
        prev
          .map((e) => (e.id === id ? { ...e, ...(actualizado || { orden: nuevoOrden }) } : e))
          .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99))
      );
      mostrarFeedback(`Orden de "${getFullName(miembro)}" actualizado a #${nuevoOrden}.`);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el orden.');
    } finally {
      setProcesandoId(null);
    }
  };

  const abrirModalCrear = () => {
    const maxOrden = estilistas.reduce((max, e) => Math.max(max, Number(e.orden || 0)), 0);
    setModoModal('crear');
    setEditandoId(null);
    setFormError('');
    setFormData({
      ...INITIAL_FORM,
      orden: maxOrden + 1,
    });
    setModalAbierto(true);
  };

  const abrirModalEditar = (miembro) => {
    setModoModal('editar');
    setEditandoId(miembro.id);
    setFormError('');
    setFormData({
      nombre: miembro.nombre || '',
      apellido: miembro.apellido || '',
      especialidad: miembro.especialidad || '',
      bio: miembro.bio || miembro.descripcion || '',
      nivel: miembro.nivel || 'senior',
      orden: miembro.orden ?? 1,
      foto_url: miembro.foto_url || '/images/maestros_tijera/carolina_valenzuela.webp',
      imagen_base64: '',
      activo: miembro.activo !== false,
      servicios_ids: Array.isArray(miembro.servicios_ids) ? miembro.servicios_ids : [],
    });
    setModalAbierto(true);
  };

  const cerrarModalFormulario = () => {
    if (guardandoModal) return;
    setModalAbierto(false);
    setFormError('');
  };

  const procesarArchivoImagen = async (file) => {
    if (!file) return;
    setFormError('');
    try {
      const base64Opt = await optimizarImagenRetrato(file);
      setFormData((prev) => ({
        ...prev,
        imagen_base64: base64Opt,
        foto_url: base64Opt,
      }));
    } catch (err) {
      setFormError(err.message || 'Error al procesar la imagen.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivoImagen(file);
  };

  const handleDropImagen = (e) => {
    e.preventDefault();
    setArrastrandoImagen(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) procesarArchivoImagen(file);
  };

  const toggleServicioAsignado = (serviceId) => {
    setFormData((prev) => {
      const exists = prev.servicios_ids.some((id) => String(id) === String(serviceId));
      return {
        ...prev,
        servicios_ids: exists
          ? prev.servicios_ids.filter((id) => String(id) !== String(serviceId))
          : [...prev.servicios_ids, serviceId],
      };
    });
  };

  const handleGuardarMiembro = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.nombre || formData.nombre.trim().length < 2) {
      setFormError('El nombre del profesional debe tener al menos 2 caracteres.');
      return;
    }

    const ordenNum = Number(formData.orden);
    if (!Number.isInteger(ordenNum) || ordenNum < 0) {
      setFormError('El orden de visualización debe ser un número entero positivo.');
      return;
    }

    setGuardandoModal(true);
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        especialidad: formData.especialidad.trim() || 'Estilista Profesional',
        bio: formData.bio.trim(),
        nivel: formData.nivel || 'senior',
        orden: ordenNum,
        activo: Boolean(formData.activo),
        servicios_ids: formData.servicios_ids,
        foto_url: formData.imagen_base64 ? '' : formData.foto_url.trim(),
        ...(formData.imagen_base64 ? { imagen_base64: formData.imagen_base64 } : {}),
      };

      if (modoModal === 'crear') {
        const creado = await crearEstilistaAdmin(payload, authHeaders());
        setEstilistas((prev) =>
          [...prev, creado].sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99))
        );
        mostrarFeedback(
          `"${getFullName(creado)}" añadido al equipo y sincronizado con Maestros de la Tijera & Color.`
        );
      } else {
        const actualizado = await actualizarEstilistaAdmin(editandoId, payload, authHeaders());
        setEstilistas((prev) =>
          prev
            .map((item) => (item.id === editandoId ? { ...item, ...actualizado } : item))
            .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99))
        );
        mostrarFeedback(`Cambios guardados en "${getFullName(actualizado)}".`);
      }

      setModalAbierto(false);
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error al guardar el miembro del equipo.');
    } finally {
      setGuardandoModal(false);
    }
  };

  const confirmarEliminacion = async () => {
    if (!miembroAEliminar) return;
    const target = miembroAEliminar;
    setProcesandoId(target.id);
    setEliminarError('');
    try {
      await eliminarEstilistaAdmin(target.id, authHeaders());
      setEstilistas((prev) => prev.filter((e) => e.id !== target.id));
      setMiembroAEliminar(null);
      mostrarFeedback(`"${getFullName(target)}" fue eliminado del equipo.`);
    } catch (err) {
      setEliminarError(err.message || 'No se pudo eliminar al miembro del equipo.');
    } finally {
      setProcesandoId(null);
    }
  };

  // Métricas
  const totalVisibles = estilistas.filter((e) => e.activo !== false).length;
  const totalOcultos = estilistas.filter((e) => e.activo === false).length;

  // Filtrado
  const estilistasFiltrados = estilistas.filter((e) => {
    const q = filtroBusqueda.trim().toLowerCase();
    if (q) {
      const matchTexto =
        getFullName(e).toLowerCase().includes(q) ||
        String(e.especialidad || '').toLowerCase().includes(q) ||
        String(e.bio || '').toLowerCase().includes(q);
      if (!matchTexto) return false;
    }
    if (filtroVisibilidad === 'visibles' && e.activo === false) return false;
    if (filtroVisibilidad === 'ocultos' && e.activo !== false) return false;
    return true;
  });

  const previewFullName =
    [formData.nombre.trim(), formData.apellido.trim()].filter(Boolean).join(' ') ||
    'Nombre del Profesional';
  const previewFirstName = (formData.nombre.trim() || 'Estilista').split(' ')[0];

  return (
    <div className="admin-reservas admin-equipo admin-section">
      {/* Métricas rápidas */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card admin-stat-card--total">
          <span className="material-symbols-outlined">groups</span>
          <div>
            <span className="admin-stat-number">{estilistas.length}</span>
            <span className="admin-stat-label">Total Equipo</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--success">
          <span className="material-symbols-outlined">visibility</span>
          <div>
            <span className="admin-stat-number">{totalVisibles}</span>
            <span className="admin-stat-label">Visibles en Sitio &amp; Reservas</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--warning">
          <span className="material-symbols-outlined">visibility_off</span>
          <div>
            <span className="admin-stat-number">{totalOcultos}</span>
            <span className="admin-stat-label">Ocultos / Pausados</span>
          </div>
        </div>
      </div>

      {/* Filtros y botón de creación */}
      <div className="admin-filters">
        <div className="admin-filter-group">
          <label htmlFor="filtro-equipo-busqueda" className="admin-form-label">
            Buscar Profesional
          </label>
          <input
            id="filtro-equipo-busqueda"
            type="text"
            className="admin-form-input"
            placeholder="Nombre, especialidad o descripción..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
          />
        </div>

        <div className="admin-filter-group">
          <label htmlFor="filtro-equipo-visibilidad" className="admin-form-label">
            Visibilidad
          </label>
          <select
            id="filtro-equipo-visibilidad"
            className="admin-form-select"
            value={filtroVisibilidad}
            onChange={(e) => setFiltroVisibilidad(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="visibles">Visibles en Maestros de la Tijera &amp; Color</option>
            <option value="ocultos">Ocultos del Sitio Público</option>
          </select>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => {
            setFiltroBusqueda('');
            setFiltroVisibilidad('');
          }}
        >
          <span className="material-symbols-outlined">filter_alt_off</span>
          Limpiar
        </button>

        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={cargarDatos}
          disabled={loading}
        >
          <span className="material-symbols-outlined">refresh</span>
          Actualizar
        </button>

        <button
          id="admin-nuevo-estilista-btn"
          type="button"
          className="admin-btn admin-btn--primary admin-btn--create-service"
          onClick={abrirModalCrear}
        >
          <span className="material-symbols-outlined">person_add</span>
          Nuevo Miembro
        </button>
      </div>

      {/* Banner de confirmación en tiempo real */}
      {feedbackBanner && (
        <div className="admin-success-banner" role="status">
          <span className="material-symbols-outlined">task_alt</span>
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* Estados de carga y error */}
      {loading && (
        <div className="admin-loading">
          <div className="admin-spinner" />
          <span>Cargando equipo de Maestros de la Tijera &amp; Color...</span>
        </div>
      )}

      {!loading && error && (
        <div className="admin-error-banner" role="alert">
          <span className="material-symbols-outlined">warning</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && estilistasFiltrados.length === 0 && (
        <div className="admin-empty-state">
          <span className="material-symbols-outlined">groups</span>
          <p>No se encontraron miembros del equipo con los filtros seleccionados.</p>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={abrirModalCrear}
          >
            <span className="material-symbols-outlined">person_add</span>
            Añadir Miembro al Equipo
          </button>
        </div>
      )}

      {/* Tabla de control del equipo */}
      {!loading && !error && estilistasFiltrados.length > 0 && (
        <div className="admin-table-wrapper">
          <table className="admin-table admin-equipo-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Profesional &amp; Descripción</th>
                <th>Nivel &amp; Servicios</th>
                <th>Visibilidad Web</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {estilistasFiltrados.map((m) => {
                const nivelCfg =
                  NIVELES_CONFIG[String(m.nivel || 'senior').toLowerCase()] ||
                  NIVELES_CONFIG.senior;
                const isProcessing = procesandoId === m.id;
                const fullName = getFullName(m);
                const serviciosCount = Array.isArray(m.servicios_ids) ? m.servicios_ids.length : 0;

                return (
                  <tr
                    key={m.id}
                    className={`admin-table-row ${isProcessing ? 'admin-table-row--processing' : ''} ${
                      m.activo === false ? 'admin-table-row--muted' : ''
                    }`}
                  >
                    {/* Orden */}
                    <td data-label="Orden" className="admin-cell-orden">
                      <div className="admin-order-control">
                        <span className="admin-order-badge" title="Orden en Maestros de la Tijera & Color">
                          #{m.orden ?? 1}
                        </span>
                        <div className="admin-order-arrows">
                          <button
                            type="button"
                            className="admin-order-btn"
                            onClick={() => handleCambiarOrden(m, -1)}
                            disabled={isProcessing || Number(m.orden || 1) <= 1}
                            title="Subir posición"
                            aria-label={`Subir posición de ${fullName}`}
                          >
                            <span className="material-symbols-outlined">keyboard_arrow_up</span>
                          </button>
                          <button
                            type="button"
                            className="admin-order-btn"
                            onClick={() => handleCambiarOrden(m, 1)}
                            disabled={isProcessing}
                            title="Bajar posición"
                            aria-label={`Bajar posición de ${fullName}`}
                          >
                            <span className="material-symbols-outlined">keyboard_arrow_down</span>
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Retrato + Nombre + Especialidad + Descripción */}
                    <td data-label="Profesional" className="admin-cell-servicio-info">
                      <div className="admin-service-media-row">
                        <div className="admin-equipo-thumb-wrapper">
                          <img
                            src={m.foto_url || '/images/maestros_tijera/carolina_valenzuela.webp'}
                            alt={fullName}
                            className="admin-equipo-thumb"
                          />
                        </div>
                        <div className="admin-service-texts">
                          <div className="admin-cell-primary admin-service-name">{fullName}</div>
                          {m.especialidad && (
                            <div className="admin-service-eyebrow">{m.especialidad}</div>
                          )}
                          {m.bio && (
                            <div className="admin-cell-secondary admin-service-desc-clamp">
                              {m.bio}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Nivel & Servicios */}
                    <td data-label="Nivel">
                      <span className={`admin-badge admin-badge--${nivelCfg.color}`}>
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {nivelCfg.icon}
                        </span>
                        {nivelCfg.label}
                      </span>
                      <div className="admin-duration-badge">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '13px', verticalAlign: 'middle', marginRight: '3px' }}
                        >
                          content_cut
                        </span>
                        {serviciosCount > 0
                          ? `${serviciosCount} servicio${serviciosCount === 1 ? '' : 's'} asignado${serviciosCount === 1 ? '' : 's'}`
                          : 'Todos los servicios'}
                      </div>
                    </td>

                    {/* Toggle Visibilidad */}
                    <td data-label="Visibilidad" className="admin-cell-toggle">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={m.activo !== false}
                        aria-label={`Visibilidad de ${fullName} en Maestros de la Tijera y Reservas`}
                        className={`admin-switch ${m.activo !== false ? 'admin-switch--on' : ''}`}
                        onClick={() => handleToggleVisibilidad(m)}
                        disabled={isProcessing}
                      >
                        <span className="admin-switch-thumb" />
                        <span className="admin-switch-label">
                          {m.activo !== false ? 'Visible' : 'Oculto'}
                        </span>
                      </button>
                    </td>

                    {/* Acciones */}
                    <td data-label="Acciones" className="admin-cell-acciones">
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="admin-action-btn admin-action-btn--edit"
                          onClick={() => abrirModalEditar(m)}
                          disabled={isProcessing}
                          title="Editar nombre, descripción e imagen"
                          aria-label={`Editar a ${fullName}`}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                          <span className="admin-action-label" aria-hidden="true">Editar</span>
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn admin-action-btn--cancel"
                          onClick={() => {
                            setEliminarError('');
                            setMiembroAEliminar(m);
                          }}
                          disabled={isProcessing}
                          title="Eliminar miembro del equipo"
                          aria-label={`Eliminar a ${fullName}`}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                          <span className="admin-action-label" aria-hidden="true">Eliminar</span>
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

      {/* Modal de Creación / Edición */}
      {modalAbierto && (
        <div
          className="admin-modal-overlay"
          onClick={cerrarModalFormulario}
          role="presentation"
        >
          <div
            className="admin-modal-card admin-modal-card--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-equipo-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header admin-modal-header--between">
              <div className="admin-modal-header-left">
                <div className="admin-modal-icon admin-modal-icon--gold" aria-hidden="true">
                  <span className="material-symbols-outlined">
                    {modoModal === 'crear' ? 'person_add' : 'manage_accounts'}
                  </span>
                </div>
                <div>
                  <h3 id="admin-equipo-modal-title" className="admin-modal-title">
                    {modoModal === 'crear'
                      ? 'Nuevo Miembro del Equipo'
                      : 'Editar Miembro del Equipo'}
                  </h3>
                  <p className="admin-modal-subtitle">
                    Los cambios se reflejan de inmediato en &ldquo;Maestros de la Tijera &amp; Color&rdquo; y en el formulario de reservas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={cerrarModalFormulario}
                disabled={guardandoModal}
                aria-label="Cerrar modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleGuardarMiembro} className="admin-service-form">
              <div className="admin-service-form-grid">
                {/* Columna Izquierda: Datos del Profesional */}
                <div className="admin-service-form-col">
                  <div className="admin-service-form-row">
                    <div className="admin-filter-group">
                      <label htmlFor="est-nombre" className="admin-form-label">
                        Nombre *
                      </label>
                      <input
                        id="est-nombre"
                        type="text"
                        className="admin-form-input"
                        placeholder="Ej. Sofía"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                      />
                    </div>
                    <div className="admin-filter-group">
                      <label htmlFor="est-apellido" className="admin-form-label">
                        Apellido
                      </label>
                      <input
                        id="est-apellido"
                        type="text"
                        className="admin-form-input"
                        placeholder="Ej. Herrera"
                        value={formData.apellido}
                        onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="admin-filter-group">
                    <label htmlFor="est-especialidad" className="admin-form-label">
                      Especialidad / Cargo
                    </label>
                    <input
                      id="est-especialidad"
                      type="text"
                      className="admin-form-input"
                      placeholder="Ej. Colorista Senior & Visagismo"
                      value={formData.especialidad}
                      onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
                    />
                  </div>

                  <div className="admin-service-form-row">
                    <div className="admin-filter-group">
                      <label htmlFor="est-nivel" className="admin-form-label">
                        Nivel Profesional
                      </label>
                      <select
                        id="est-nivel"
                        className="admin-form-select"
                        value={formData.nivel}
                        onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}
                      >
                        {Object.entries(NIVELES_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>
                            {cfg.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-filter-group">
                      <label htmlFor="est-orden" className="admin-form-label">
                        Orden Visual (#)
                      </label>
                      <input
                        id="est-orden"
                        type="number"
                        min="1"
                        max="99"
                        className="admin-form-input"
                        value={formData.orden}
                        onChange={(e) => setFormData({ ...formData, orden: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="admin-filter-group">
                    <label htmlFor="est-bio" className="admin-form-label">
                      Descripción / Biografía Corta
                    </label>
                    <textarea
                      id="est-bio"
                      rows={3}
                      className="admin-form-input admin-form-textarea"
                      placeholder="Describe la trayectoria, especialidad y estilo de atención del profesional..."
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    />
                  </div>

                  {/* Control de Visibilidad */}
                  <div className="admin-service-toggles-box">
                    <label className="admin-checkbox-row">
                      <input
                        type="checkbox"
                        checked={formData.activo}
                        onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                      />
                      <div>
                        <strong>Visible en &ldquo;Maestros de la Tijera &amp; Color&rdquo; y Reservas</strong>
                        <span>Si se desactiva, se ocultará de la página principal y del selector de citas</span>
                      </div>
                    </label>
                  </div>

                  {/* Servicios asignados (opcional) */}
                  {serviciosCatalogo.length > 0 && (
                    <div className="admin-filter-group">
                      <label className="admin-form-label">
                        Servicios que realiza (opcional — sin selección atiende todos)
                      </label>
                      <div className="admin-equipo-servicios-grid">
                        {serviciosCatalogo.map((svc) => {
                          const checked = formData.servicios_ids.some(
                            (id) => String(id) === String(svc.id)
                          );
                          return (
                            <label
                              key={svc.id}
                              className={`admin-equipo-servicio-chip ${
                                checked ? 'admin-equipo-servicio-chip--checked' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleServicioAsignado(svc.id)}
                              />
                              <span>{svc.nombre}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Carga de Imagen y Vista Previa */}
                <div className="admin-service-form-col">
                  <label className="admin-form-label">Fotografía de Retrato (3:4 recomendado)</label>

                  <div
                    className={`admin-image-dropzone ${
                      arrastrandoImagen ? 'admin-image-dropzone--active' : ''
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setArrastrandoImagen(true);
                    }}
                    onDragLeave={() => setArrastrandoImagen(false)}
                    onDrop={handleDropImagen}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/webp,image/png,image/jpeg,image/jpg"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                    <span className="material-symbols-outlined admin-dropzone-icon">
                      add_photo_alternate
                    </span>
                    <div className="admin-dropzone-text">
                      <strong>Haz clic para adjuntar una foto</strong> o arrástrala aquí
                      <span>Formatos soportados: WebP, JPG, PNG (optimización automática)</span>
                    </div>
                  </div>

                  <div className="admin-filter-group">
                    <label htmlFor="est-galeria" className="admin-form-label">
                      O elegir de la galería del equipo
                    </label>
                    <select
                      id="est-galeria"
                      className="admin-form-select"
                      value={
                        GALERIA_RETRATOS.some((g) => g.url === formData.foto_url)
                          ? formData.foto_url
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          setFormData({
                            ...formData,
                            foto_url: e.target.value,
                            imagen_base64: '',
                          });
                        }
                      }}
                    >
                      <option value="">— Imagen personalizada adjunta —</option>
                      {GALERIA_RETRATOS.map((g) => (
                        <option key={g.url} value={g.url}>
                          {g.label} ({g.url.split('/').pop()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Vista previa en vivo de la tarjeta en "Maestros de la Tijera & Color" */}
                  <div className="admin-live-preview-wrapper">
                    <span className="admin-form-label">
                      Vista Previa en &ldquo;Maestros de la Tijera &amp; Color&rdquo;
                    </span>
                    <div className="admin-equipo-preview-card">
                      <div className="admin-equipo-preview-img-box">
                        <img
                          src={formData.foto_url || '/images/maestros_tijera/carolina_valenzuela.webp'}
                          alt={previewFullName}
                          className="admin-equipo-preview-img"
                        />
                        <div className="admin-equipo-preview-cta">
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                            calendar_month
                          </span>
                          <span>Agendar con {previewFirstName}</span>
                        </div>
                      </div>
                      <h4 className="admin-equipo-preview-name">{previewFullName}</h4>
                      <p className="admin-equipo-preview-role">
                        {formData.especialidad.trim() || 'Estilista Profesional'}
                      </p>
                      <p className="admin-equipo-preview-bio">
                        {formData.bio.trim() ||
                          'Descripción breve de su especialidad y enfoque de atención.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="admin-error-banner admin-modal-error" role="alert">
                  <span className="material-symbols-outlined">warning</span>
                  <span>{formError}</span>
                </div>
              )}

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={cerrarModalFormulario}
                  disabled={guardandoModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={guardandoModal}
                >
                  {guardandoModal ? (
                    <>
                      <span className="admin-btn-spinner admin-btn-spinner--sm" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">save</span>
                      <span>
                        {modoModal === 'crear' ? 'Añadir al Equipo' : 'Guardar Cambios'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {miembroAEliminar && (
        <div
          className="admin-modal-overlay"
          onClick={() => {
            if (!procesandoId) setMiembroAEliminar(null);
          }}
          role="presentation"
        >
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-equipo-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="admin-modal-icon admin-modal-icon--danger" aria-hidden="true">
                <span className="material-symbols-outlined">person_remove</span>
              </div>
              <div>
                <h3 id="admin-equipo-delete-title" className="admin-modal-title">
                  Eliminar Miembro del Equipo
                </h3>
                <p className="admin-modal-subtitle">
                  ¿Confirmas que deseas eliminar a{' '}
                  <strong>{getFullName(miembroAEliminar)}</strong>? Dejará de aparecer en
                  &ldquo;Maestros de la Tijera &amp; Color&rdquo; y en el formulario de reservas.
                </p>
              </div>
            </div>

            {eliminarError && (
              <div className="admin-error-banner admin-modal-error" role="alert">
                <span className="material-symbols-outlined">warning</span>
                <span>{eliminarError}</span>
              </div>
            )}

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setMiembroAEliminar(null)}
                disabled={Boolean(procesandoId)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={confirmarEliminacion}
                disabled={Boolean(procesandoId)}
              >
                {procesandoId ? (
                  <>
                    <span className="admin-btn-spinner admin-btn-spinner--sm" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">delete_forever</span>
                    <span>Sí, Eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

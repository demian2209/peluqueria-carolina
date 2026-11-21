'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { authHeaders } from '../services/authService';
import {
  getServiciosAdmin,
  crearServicioAdmin,
  actualizarServicioAdmin,
  toggleVisibilidadServicioAdmin,
  eliminarServicioAdmin,
} from '../services/api';

const CATEGORIAS_CONFIG = {
  coloracion:  { label: 'Coloración & Balayage', icon: 'palette',           color: 'warning' },
  corte:       { label: 'Corte & Arquitectura',  icon: 'content_cut',       color: 'info'    },
  barberia:    { label: 'Barbería Clásica',      icon: 'face_6',            color: 'success' },
  tratamiento: { label: 'Tratamientos Spa',      icon: 'water_drop',        color: 'info'    },
  styling:     { label: 'Estilismo & Peinado',   icon: 'auto_awesome',      color: 'warning' },
  manicura:    { label: 'Manicura & Nails',      icon: 'brush',             color: 'success' },
};

const ICONOS_DISPONIBLES = [
  { value: 'auto_awesome',      label: 'Destello (Signature)' },
  { value: 'content_cut',       label: 'Tijeras (Corte)' },
  { value: 'palette',           label: 'Paleta (Coloración)' },
  { value: 'face_6',            label: 'Barbería / Rostro' },
  { value: 'spa',               label: 'Spa & Ritual' },
  { value: 'water_drop',        label: 'Hidratación / Botox' },
  { value: 'eco',               label: 'Orgánico / Vegano' },
  { value: 'health_and_safety', label: 'Reparación (K18)' },
  { value: 'brush',             label: 'Nails & Manicura' },
];

const GALERIA_PREDEFINIDA = [
  { label: 'Balayage',         url: '/images/servicios/servicio_1.webp' },
  { label: 'Corte Mujer',      url: '/images/servicios/servicio_2.webp' },
  { label: 'Corte Caballero',  url: '/images/servicios/servicio_3.webp' },
  { label: 'Ritual Barba',     url: '/images/servicios/servicio_4.webp' },
  { label: 'Coloración',       url: '/images/servicios/servicio_5.webp' },
  { label: 'Botox Capilar',    url: '/images/servicios/servicio_6.webp' },
  { label: 'Alisado Orgánico', url: '/images/servicios/servicio_7.webp' },
  { label: 'Masaje K18',       url: '/images/servicios/servicio_8.webp' },
  { label: 'Peinado Social',   url: '/images/servicios/servicio_9.webp' },
  { label: 'Manicura Rusa',    url: '/images/servicios/servicio_10.webp' },
];

const INITIAL_FORM = {
  nombre: '',
  etiqueta: '',
  descripcion: '',
  categoria: 'coloracion',
  precio: '',
  duracion_min: 60,
  orden: 1,
  icono: 'auto_awesome',
  imagen_url: '/images/servicios/servicio_1.webp',
  imagen_base64: '',
  en_seleccion: true,
  activo: true,
  destacado: false,
};

/**
 * Optimiza y redimensiona una imagen en el navegador mediante Canvas (máx 1200px, WebP/JPEG)
 * para garantizar cargas rápidas y previsualización inmediata.
 */
function optimizarImagenArchivo(file) {
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
        const maxWidth = 1200;
        const maxHeight = 900;
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

        let dataUrl = canvas.toDataURL('image/webp', 0.85);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }
        resolve(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminServiciosList() {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState('');

  // Filtros
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroVisibilidad, setFiltroVisibilidad] = useState('');

  // Estados de acción por fila
  const [procesandoId, setProcesandoId] = useState(null);

  // Edición rápida de precio en línea
  const [precioEditId, setPrecioEditId] = useState(null);
  const [precioTempValor, setPrecioTempValor] = useState('');

  // Modal de creación / edición
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('crear'); // 'crear' | 'editar'
  const [servicioEditandoId, setServicioEditandoId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [guardandoModal, setGuardandoModal] = useState(false);
  const [arrastrandoImagen, setArrastrandoImagen] = useState(false);
  const fileInputRef = useRef(null);

  // Modal de confirmación para eliminar
  const [servicioAEliminar, setServicioAEliminar] = useState(null);
  const [eliminarError, setEliminarError] = useState('');

  const mostrarFeedback = useCallback((msg) => {
    setFeedbackBanner(msg);
    const timer = setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? '' : prev));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const cargarServicios = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getServiciosAdmin(authHeaders());
      const ordenados = [...(data || [])].sort(
        (a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99)
      );
      setServicios(ordenados);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el catálogo de servicios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initLoad = async () => {
      if (active) await cargarServicios();
    };
    initLoad();
    return () => {
      active = false;
    };
  }, [cargarServicios]);

  // Cerrar modales con tecla Escape
  useEffect(() => {
    if (!modalAbierto && !servicioAEliminar) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !guardandoModal && !procesandoId) {
        if (modalAbierto) {
          setModalAbierto(false);
          setFormError('');
        }
        if (servicioAEliminar) {
          setServicioAEliminar(null);
          setEliminarError('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalAbierto, servicioAEliminar, guardandoModal, procesandoId]);

  const formatCLP = (valor) => `$${Number(valor || 0).toLocaleString('es-CL')}`;

  // Toggle rápido de visibilidad en "Nuestra Selección" o estado "Activo"
  const handleToggleVisibilidad = async (servicio, campo) => {
    const id = servicio.id;
    setProcesandoId(id);
    setError('');
    const nuevoValor = !servicio[campo];

    // Actualización optimista inmediata en UI
    setServicios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [campo]: nuevoValor } : s))
    );

    try {
      const payload =
        campo === 'en_seleccion'
          ? { en_seleccion: nuevoValor, activo: nuevoValor ? true : servicio.activo }
          : { activo: nuevoValor };

      const actualizado = await toggleVisibilidadServicioAdmin(id, payload, authHeaders());
      if (actualizado) {
        setServicios((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...actualizado } : s))
        );
      }
      mostrarFeedback(
        campo === 'en_seleccion'
          ? `"${servicio.nombre}" ${nuevoValor ? 'añadido a' : 'ocultado de'} Nuestra Selección.`
          : `"${servicio.nombre}" marcado como ${nuevoValor ? 'activo' : 'inactivo'}.`
      );
    } catch (err) {
      // Revertir en caso de error
      setServicios((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [campo]: !nuevoValor } : s))
      );
      setError(err.message || 'Error al actualizar la visibilidad.');
    } finally {
      setProcesandoId(null);
    }
  };

  // Cambio rápido de orden de visualización (Subir / Bajar)
  const handleCambiarOrden = async (servicio, direccion) => {
    const id = servicio.id;
    const nuevoOrden = Math.max(1, Number(servicio.orden || 1) + direccion);
    if (nuevoOrden === Number(servicio.orden)) return;

    setProcesandoId(id);
    setError('');
    try {
      const actualizado = await actualizarServicioAdmin(
        id,
        { orden: nuevoOrden },
        authHeaders()
      );
      setServicios((prev) =>
        prev
          .map((s) => (s.id === id ? { ...s, ...(actualizado || { orden: nuevoOrden }) } : s))
          .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99))
      );
      mostrarFeedback(`Orden de "${servicio.nombre}" actualizado a #${nuevoOrden}.`);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el orden.');
    } finally {
      setProcesandoId(null);
    }
  };

  // Edición rápida de precio en línea
  const iniciarEdicionPrecio = (servicio) => {
    setPrecioEditId(servicio.id);
    setPrecioTempValor(String(servicio.precio ?? 0));
  };

  const cancelarEdicionPrecio = () => {
    setPrecioEditId(null);
    setPrecioTempValor('');
  };

  const guardarPrecioRapido = async (servicio) => {
    const nuevoPrecio = Number(precioTempValor);
    if (Number.isNaN(nuevoPrecio) || nuevoPrecio < 0) {
      setError('El precio ingresado no es válido.');
      return;
    }

    const id = servicio.id;
    setProcesandoId(id);
    setError('');
    try {
      const actualizado = await actualizarServicioAdmin(
        id,
        { precio: nuevoPrecio },
        authHeaders()
      );
      setServicios((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...(actualizado || { precio: nuevoPrecio }) } : s))
      );
      setPrecioEditId(null);
      setPrecioTempValor('');
      mostrarFeedback(`Precio de "${servicio.nombre}" actualizado a ${formatCLP(nuevoPrecio)}.`);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el precio.');
    } finally {
      setProcesandoId(null);
    }
  };

  // Abrir modal para Crear nuevo servicio
  const abrirModalCrear = () => {
    const maxOrden = servicios.reduce((max, s) => Math.max(max, Number(s.orden || 0)), 0);
    setModoModal('crear');
    setServicioEditandoId(null);
    setFormError('');
    setFormData({
      ...INITIAL_FORM,
      orden: maxOrden + 1,
    });
    setModalAbierto(true);
  };

  // Abrir modal para Editar servicio existente
  const abrirModalEditar = (servicio) => {
    setModoModal('editar');
    setServicioEditandoId(servicio.id);
    setFormError('');
    setFormData({
      nombre: servicio.nombre || '',
      etiqueta: servicio.etiqueta || '',
      descripcion: servicio.descripcion || '',
      categoria: servicio.categoria || 'coloracion',
      precio: servicio.precio ?? 0,
      duracion_min: servicio.duracion_min ?? 60,
      orden: servicio.orden ?? 1,
      icono: servicio.icono || 'auto_awesome',
      imagen_url: servicio.imagen_url || '/images/servicios/servicio_1.webp',
      imagen_base64: '',
      en_seleccion: servicio.en_seleccion !== false,
      activo: servicio.activo !== false,
      destacado: Boolean(servicio.destacado),
    });
    setModalAbierto(true);
  };

  const cerrarModalFormulario = () => {
    if (guardandoModal) return;
    setModalAbierto(false);
    setFormError('');
  };

  // Procesar archivo de imagen adjuntado
  const procesarArchivoImagen = async (file) => {
    if (!file) return;
    setFormError('');
    try {
      const base64Opt = await optimizarImagenArchivo(file);
      setFormData((prev) => ({
        ...prev,
        imagen_base64: base64Opt,
        imagen_url: base64Opt,
      }));
    } catch (err) {
      setFormError(err.message || 'Error al procesar la imagen.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      procesarArchivoImagen(file);
    }
  };

  const handleDropImagen = (e) => {
    e.preventDefault();
    setArrastrandoImagen(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      procesarArchivoImagen(file);
    }
  };

  // Guardar formulario (Crear o Editar)
  const handleGuardarServicio = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.nombre || formData.nombre.trim().length < 3) {
      setFormError('El nombre del servicio debe tener al menos 3 caracteres.');
      return;
    }

    const precioNum = Number(formData.precio);
    if (formData.precio === '' || Number.isNaN(precioNum) || precioNum < 0) {
      setFormError('Ingresa un precio válido mayor o igual a $0.');
      return;
    }

    const duracionNum = Number(formData.duracion_min);
    if (!Number.isInteger(duracionNum) || duracionNum <= 0 || duracionNum > 600) {
      setFormError('La duración debe ser un número entero entre 1 y 600 minutos.');
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
        etiqueta: formData.etiqueta.trim() || CATEGORIAS_CONFIG[formData.categoria]?.label || 'Servicio Exclusivo',
        descripcion: formData.descripcion.trim(),
        categoria: formData.categoria,
        precio: precioNum,
        duracion_min: duracionNum,
        orden: ordenNum,
        icono: formData.icono || 'auto_awesome',
        imagen_url: formData.imagen_base64 ? '' : formData.imagen_url.trim(),
        ...(formData.imagen_base64 ? { imagen_base64: formData.imagen_base64 } : {}),
        en_seleccion: Boolean(formData.en_seleccion),
        activo: Boolean(formData.activo),
        destacado: Boolean(formData.destacado),
      };

      if (modoModal === 'crear') {
        const creado = await crearServicioAdmin(payload, authHeaders());
        setServicios((prev) =>
          [...prev, creado].sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99))
        );
        mostrarFeedback(`Servicio "${creado.nombre}" creado y sincronizado con Nuestra Selección.`);
      } else {
        const actualizado = await actualizarServicioAdmin(
          servicioEditandoId,
          payload,
          authHeaders()
        );
        setServicios((prev) =>
          prev
            .map((s) => (s.id === servicioEditandoId ? { ...s, ...actualizado } : s))
            .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99))
        );
        mostrarFeedback(`Cambios guardados en "${actualizado.nombre}".`);
      }

      setModalAbierto(false);
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error al guardar el servicio.');
    } finally {
      setGuardandoModal(false);
    }
  };

  // Confirmar eliminación de servicio
  const confirmarEliminacion = async () => {
    if (!servicioAEliminar) return;
    const id = servicioAEliminar.id;
    const nombre = servicioAEliminar.nombre;
    setProcesandoId(id);
    setEliminarError('');
    try {
      await eliminarServicioAdmin(id, authHeaders());
      setServicios((prev) => prev.filter((s) => s.id !== id));
      setServicioAEliminar(null);
      mostrarFeedback(`Servicio "${nombre}" eliminado del catálogo.`);
    } catch (err) {
      setEliminarError(err.message || 'No se pudo eliminar el servicio.');
    } finally {
      setProcesandoId(null);
    }
  };

  // Filtrado de servicios en tabla
  const serviciosFiltrados = servicios.filter((s) => {
    if (filtroCategoria && String(s.categoria || '').toLowerCase() !== filtroCategoria) {
      return false;
    }
    if (filtroVisibilidad === 'en_seleccion' && (!s.en_seleccion || !s.activo)) {
      return false;
    }
    if (filtroVisibilidad === 'ocultos' && s.en_seleccion && s.activo) {
      return false;
    }
    if (filtroVisibilidad === 'inactivos' && s.activo !== false) {
      return false;
    }
    if (filtroBusqueda.trim()) {
      const term = filtroBusqueda.trim().toLowerCase();
      const nombre = String(s.nombre || '').toLowerCase();
      const etiqueta = String(s.etiqueta || '').toLowerCase();
      const desc = String(s.descripcion || '').toLowerCase();
      return nombre.includes(term) || etiqueta.includes(term) || desc.includes(term);
    }
    return true;
  });

  const totalEnSeleccion = servicios.filter((s) => s.en_seleccion !== false && s.activo !== false).length;
  const totalActivos = servicios.filter((s) => s.activo !== false).length;
  const totalDestacados = servicios.filter((s) => s.destacado === true).length;

  return (
    <div className="admin-reservas admin-servicios">
      {/* Métricas rápidas */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card admin-stat-card--total">
          <span className="material-symbols-outlined">content_cut</span>
          <div>
            <span className="admin-stat-number">{servicios.length}</span>
            <span className="admin-stat-label">Total Catálogo</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--success">
          <span className="material-symbols-outlined">auto_awesome</span>
          <div>
            <span className="admin-stat-number">{totalEnSeleccion}</span>
            <span className="admin-stat-label">En &ldquo;Nuestra Selección&rdquo;</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--warning">
          <span className="material-symbols-outlined">check_circle</span>
          <div>
            <span className="admin-stat-number">{totalActivos}</span>
            <span className="admin-stat-label">Activos en Reserva</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--total">
          <span className="material-symbols-outlined">star</span>
          <div>
            <span className="admin-stat-number">{totalDestacados}</span>
            <span className="admin-stat-label">Tarjeta Hero Destacada</span>
          </div>
        </div>
      </div>

      {/* Filtros y botón de creación */}
      <div className="admin-filters">
        <div className="admin-filter-group">
          <label htmlFor="filtro-servicio-busqueda" className="admin-form-label">
            Buscar Servicio
          </label>
          <input
            id="filtro-servicio-busqueda"
            type="text"
            className="admin-form-input"
            placeholder="Nombre, etiqueta o detalle..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
          />
        </div>

        <div className="admin-filter-group">
          <label htmlFor="filtro-servicio-categoria" className="admin-form-label">
            Categoría
          </label>
          <select
            id="filtro-servicio-categoria"
            className="admin-form-select"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORIAS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-filter-group">
          <label htmlFor="filtro-servicio-visibilidad" className="admin-form-label">
            Visibilidad
          </label>
          <select
            id="filtro-servicio-visibilidad"
            className="admin-form-select"
            value={filtroVisibilidad}
            onChange={(e) => setFiltroVisibilidad(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="en_seleccion">Visibles en Nuestra Selección</option>
            <option value="ocultos">Ocultos de Nuestra Selección</option>
            <option value="inactivos">Servicios Inactivos</option>
          </select>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => {
            setFiltroBusqueda('');
            setFiltroCategoria('');
            setFiltroVisibilidad('');
          }}
        >
          <span className="material-symbols-outlined">filter_alt_off</span>
          Limpiar
        </button>

        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={cargarServicios}
          disabled={loading}
        >
          <span className="material-symbols-outlined">refresh</span>
          Actualizar
        </button>

        <button
          id="admin-nuevo-servicio-btn"
          type="button"
          className="admin-btn admin-btn--primary admin-btn--create-service"
          onClick={abrirModalCrear}
        >
          <span className="material-symbols-outlined">add</span>
          Nuevo Servicio
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
          <span>Cargando catálogo de Nuestra Selección...</span>
        </div>
      )}

      {!loading && error && (
        <div className="admin-error-banner" role="alert">
          <span className="material-symbols-outlined">warning</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && serviciosFiltrados.length === 0 && (
        <div className="admin-empty-state">
          <span className="material-symbols-outlined">content_cut</span>
          <p>No se encontraron servicios con los filtros seleccionados.</p>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={abrirModalCrear}
          >
            <span className="material-symbols-outlined">add</span>
            Crear Primer Servicio
          </button>
        </div>
      )}

      {/* Tabla de control del catálogo */}
      {!loading && !error && serviciosFiltrados.length > 0 && (
        <div className="admin-table-wrapper">
          <table className="admin-table admin-servicios-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Servicio &amp; Presentación</th>
                <th>Categoría &amp; Duración</th>
                <th>Precio (CLP)</th>
                <th>Nuestra Selección</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {serviciosFiltrados.map((s) => {
                const catCfg =
                  CATEGORIAS_CONFIG[String(s.categoria || '').toLowerCase()] ||
                  CATEGORIAS_CONFIG.coloracion;
                const isProcessing = procesandoId === s.id;
                const isEditingPrice = precioEditId === s.id;

                return (
                  <tr
                    key={s.id}
                    className={`admin-table-row ${isProcessing ? 'admin-table-row--processing' : ''} ${
                      !s.activo || !s.en_seleccion ? 'admin-table-row--muted' : ''
                    }`}
                  >
                    {/* Orden de visualización */}
                    <td data-label="Orden" className="admin-cell-orden">
                      <div className="admin-order-control">
                        <span className="admin-order-badge" title="Orden de visualización en Nuestra Selección">
                          #{s.orden ?? 1}
                        </span>
                        <div className="admin-order-arrows">
                          <button
                            type="button"
                            className="admin-order-btn"
                            onClick={() => handleCambiarOrden(s, -1)}
                            disabled={isProcessing || Number(s.orden || 1) <= 1}
                            title="Subir posición"
                            aria-label={`Subir posición de ${s.nombre}`}
                          >
                            <span className="material-symbols-outlined">keyboard_arrow_up</span>
                          </button>
                          <button
                            type="button"
                            className="admin-order-btn"
                            onClick={() => handleCambiarOrden(s, 1)}
                            disabled={isProcessing}
                            title="Bajar posición"
                            aria-label={`Bajar posición de ${s.nombre}`}
                          >
                            <span className="material-symbols-outlined">keyboard_arrow_down</span>
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Miniatura + Nombre + Etiqueta + Descripción */}
                    <td data-label="Servicio" className="admin-cell-servicio-info">
                      <div className="admin-service-media-row">
                        <div className="admin-service-thumb-wrapper">
                          <img
                            src={s.imagen_url || '/images/servicios/servicio_1.webp'}
                            alt={s.nombre}
                            className="admin-service-thumb"
                          />
                          {s.destacado && (
                            <span
                              className="admin-service-hero-badge"
                              title="Tarjeta Hero Destacada en Bento Grid"
                            >
                              <span className="material-symbols-outlined">star</span>
                            </span>
                          )}
                        </div>
                        <div className="admin-service-texts">
                          <div className="admin-service-tag-line">
                            <span className="material-symbols-outlined admin-service-tag-icon">
                              {s.icono || 'auto_awesome'}
                            </span>
                            <span className="admin-service-eyebrow">
                              {s.etiqueta || catCfg.label}
                            </span>
                          </div>
                          <div className="admin-cell-primary admin-service-name">{s.nombre}</div>
                          {s.descripcion && (
                            <div className="admin-cell-secondary admin-service-desc-clamp">
                              {s.descripcion}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Categoría & Duración */}
                    <td data-label="Categoría">
                      <span className={`admin-badge admin-badge--${catCfg.color}`}>
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {catCfg.icon}
                        </span>
                        {catCfg.label}
                      </span>
                      <div className="admin-duration-badge">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '13px', verticalAlign: 'middle', marginRight: '3px' }}
                        >
                          schedule
                        </span>
                        {s.duracion_min} minutos
                      </div>
                    </td>

                    {/* Precio con edición rápida */}
                    <td data-label="Precio" className="admin-cell-precio">
                      {isEditingPrice ? (
                        <div className="admin-inline-price-editor">
                          <input
                            type="number"
                            min="0"
                            step="500"
                            className="admin-inline-price-input"
                            value={precioTempValor}
                            onChange={(e) => setPrecioTempValor(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') guardarPrecioRapido(s);
                              if (e.key === 'Escape') cancelarEdicionPrecio();
                            }}
                            autoFocus
                            aria-label={`Nuevo precio para ${s.nombre}`}
                          />
                          <button
                            type="button"
                            className="admin-action-btn admin-action-btn--confirm"
                            onClick={() => guardarPrecioRapido(s)}
                            disabled={isProcessing}
                            title="Guardar precio"
                          >
                            <span className="material-symbols-outlined">check</span>
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn admin-action-btn--cancel"
                            onClick={cancelarEdicionPrecio}
                            disabled={isProcessing}
                            title="Cancelar"
                          >
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        </div>
                      ) : (
                        <div className="admin-price-display-row">
                          <span className="admin-price-value">{formatCLP(s.precio)}</span>
                          <button
                            type="button"
                            className="admin-price-quick-btn"
                            onClick={() => iniciarEdicionPrecio(s)}
                            disabled={isProcessing}
                            title="Editar precio rápido"
                            aria-label={`Editar precio de ${s.nombre}`}
                          >
                            <span className="material-symbols-outlined">payments</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Toggle rápido: En Nuestra Selección */}
                    <td data-label="Nuestra Selección" className="admin-cell-toggle">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(s.en_seleccion && s.activo)}
                        aria-label={`Mostrar ${s.nombre} en Nuestra Selección`}
                        className={`admin-switch ${s.en_seleccion && s.activo ? 'admin-switch--on' : ''}`}
                        onClick={() => handleToggleVisibilidad(s, 'en_seleccion')}
                        disabled={isProcessing}
                      >
                        <span className="admin-switch-thumb" />
                        <span className="admin-switch-label">
                          {s.en_seleccion && s.activo ? 'Visible' : 'Oculto'}
                        </span>
                      </button>
                    </td>

                    {/* Toggle rápido: Activo en Salón */}
                    <td data-label="Estado" className="admin-cell-estado">
                      <button
                        type="button"
                        className={`admin-badge admin-badge--clickable ${
                          s.activo ? 'admin-badge--success' : 'admin-badge--muted'
                        }`}
                        onClick={() => handleToggleVisibilidad(s, 'activo')}
                        disabled={isProcessing}
                        title="Clic para alternar estado Activo / Pausado"
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {s.activo ? 'visibility' : 'visibility_off'}
                        </span>
                        {s.activo ? 'Activo' : 'Pausado'}
                      </button>
                    </td>

                    {/* Acciones: Editar información/imagen y Eliminar */}
                    <td data-label="Acciones" className="admin-cell-acciones">
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="admin-action-btn admin-action-btn--edit"
                          onClick={() => abrirModalEditar(s)}
                          disabled={isProcessing}
                          title="Editar información, precio e imagen"
                          aria-label={`Editar ${s.nombre}`}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                          <span className="admin-action-label" aria-hidden="true">Editar</span>
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn admin-action-btn--cancel"
                          onClick={() => {
                            setEliminarError('');
                            setServicioAEliminar(s);
                          }}
                          disabled={isProcessing}
                          title="Eliminar servicio"
                          aria-label={`Eliminar ${s.nombre}`}
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

      {/* Modal de Creación / Edición de Servicio */}
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
            aria-labelledby="admin-servicio-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header admin-modal-header--between">
              <div className="admin-modal-header-left">
                <div className="admin-modal-icon admin-modal-icon--gold" aria-hidden="true">
                  <span className="material-symbols-outlined">
                    {modoModal === 'crear' ? 'add_circle' : 'edit_square'}
                  </span>
                </div>
                <div>
                  <h3 id="admin-servicio-modal-title" className="admin-modal-title">
                    {modoModal === 'crear'
                      ? 'Nuevo Servicio para Nuestra Selección'
                      : 'Editar Servicio del Catálogo'}
                  </h3>
                  <p className="admin-modal-subtitle">
                    Los cambios guardados se reflejan de inmediato en la vista pública del salón.
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

            <form onSubmit={handleGuardarServicio} className="admin-service-form">
              <div className="admin-service-form-grid">
                {/* Columna Izquierda: Datos del Servicio */}
                <div className="admin-service-form-col">
                  <div className="admin-filter-group">
                    <label htmlFor="svc-nombre" className="admin-form-label">
                      Nombre del Servicio *
                    </label>
                    <input
                      id="svc-nombre"
                      type="text"
                      className="admin-form-input"
                      placeholder="Ej. Balayage & Iluminación Morena"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                    />
                  </div>

                  <div className="admin-service-form-row">
                    <div className="admin-filter-group">
                      <label htmlFor="svc-etiqueta" className="admin-form-label">
                        Etiqueta Editorial (Subtítulo)
                      </label>
                      <input
                        id="svc-etiqueta"
                        type="text"
                        className="admin-form-input"
                        placeholder="Ej. Alta Coloración & Iluminación"
                        value={formData.etiqueta}
                        onChange={(e) => setFormData({ ...formData, etiqueta: e.target.value })}
                      />
                    </div>

                    <div className="admin-filter-group">
                      <label htmlFor="svc-categoria" className="admin-form-label">
                        Categoría *
                      </label>
                      <select
                        id="svc-categoria"
                        className="admin-form-select"
                        value={formData.categoria}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      >
                        {Object.entries(CATEGORIAS_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>
                            {cfg.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="admin-service-form-row admin-service-form-row--3">
                    <div className="admin-filter-group">
                      <label htmlFor="svc-precio" className="admin-form-label">
                        Precio (CLP) *
                      </label>
                      <input
                        id="svc-precio"
                        type="number"
                        min="0"
                        step="500"
                        className="admin-form-input"
                        placeholder="Ej. 45000"
                        value={formData.precio}
                        onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                        required
                      />
                    </div>

                    <div className="admin-filter-group">
                      <label htmlFor="svc-duracion" className="admin-form-label">
                        Duración (min) *
                      </label>
                      <input
                        id="svc-duracion"
                        type="number"
                        min="5"
                        max="600"
                        step="5"
                        className="admin-form-input"
                        value={formData.duracion_min}
                        onChange={(e) =>
                          setFormData({ ...formData, duracion_min: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="admin-filter-group">
                      <label htmlFor="svc-orden" className="admin-form-label">
                        Orden Visual (#)
                      </label>
                      <input
                        id="svc-orden"
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
                    <label htmlFor="svc-icono" className="admin-form-label">
                      Ícono de Tarjeta
                    </label>
                    <select
                      id="svc-icono"
                      className="admin-form-select"
                      value={formData.icono}
                      onChange={(e) => setFormData({ ...formData, icono: e.target.value })}
                    >
                      {ICONOS_DISPONIBLES.map((ic) => (
                        <option key={ic.value} value={ic.value}>
                          {ic.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-filter-group">
                    <label htmlFor="svc-descripcion" className="admin-form-label">
                      Descripción del Ritual / Servicio
                    </label>
                    <textarea
                      id="svc-descripcion"
                      rows={3}
                      className="admin-form-input admin-form-textarea"
                      placeholder="Describe las técnicas, productos y experiencia que incluye el servicio..."
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    />
                  </div>

                  {/* Controles booleanos de visibilidad */}
                  <div className="admin-service-toggles-box">
                    <label className="admin-checkbox-row">
                      <input
                        type="checkbox"
                        checked={formData.en_seleccion}
                        onChange={(e) =>
                          setFormData({ ...formData, en_seleccion: e.target.checked })
                        }
                      />
                      <div>
                        <strong>Mostrar en &ldquo;Nuestra Selección&rdquo;</strong>
                        <span>Visible en el catálogo principal de la landing page</span>
                      </div>
                    </label>

                    <label className="admin-checkbox-row">
                      <input
                        type="checkbox"
                        checked={formData.activo}
                        onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                      />
                      <div>
                        <strong>Servicio Activo para Reservas</strong>
                        <span>Habilitado en el selector de agendamiento y asistente IA</span>
                      </div>
                    </label>

                    <label className="admin-checkbox-row">
                      <input
                        type="checkbox"
                        checked={formData.destacado}
                        onChange={(e) =>
                          setFormData({ ...formData, destacado: e.target.checked })
                        }
                      />
                      <div>
                        <strong>Tarjeta Hero Destacada (Bento 8 Columnas)</strong>
                        <span>Formato panorámico principal dentro de la cuadrícula</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Columna Derecha: Carga de Imagen y Vista Previa en Vivo */}
                <div className="admin-service-form-col">
                  <label className="admin-form-label">Imagen del Servicio</label>

                  {/* Zona Drag & Drop para adjuntar imagen */}
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
                      <strong>Haz clic para adjuntar una imagen</strong> o arrástrala aquí
                      <span>Formatos soportados: WebP, JPG, PNG (optimización automática)</span>
                    </div>
                  </div>

                  {/* Selector rápido de galería existente */}
                  <div className="admin-filter-group">
                    <label htmlFor="svc-galeria" className="admin-form-label">
                      O elegir de la galería del salón / URL
                    </label>
                    <select
                      id="svc-galeria"
                      className="admin-form-select"
                      value={
                        GALERIA_PREDEFINIDA.some((g) => g.url === formData.imagen_url)
                          ? formData.imagen_url
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          setFormData({
                            ...formData,
                            imagen_url: e.target.value,
                            imagen_base64: '',
                          });
                        }
                      }}
                    >
                      <option value="">— Imagen personalizada adjunta —</option>
                      {GALERIA_PREDEFINIDA.map((g) => (
                        <option key={g.url} value={g.url}>
                          {g.label} ({g.url.split('/').pop()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Vista previa en vivo de la tarjeta de Nuestra Selección */}
                  <div className="admin-live-preview-wrapper">
                    <span className="admin-form-label">Vista Previa en &ldquo;Nuestra Selección&rdquo;</span>
                    <div className="admin-live-preview-card">
                      <img
                        src={formData.imagen_url || '/images/servicios/servicio_1.webp'}
                        alt={formData.nombre || 'Vista previa'}
                        className="admin-live-preview-img"
                      />
                      <div className="admin-live-preview-overlay">
                        <div className="admin-live-preview-top">
                          <span className="admin-live-preview-tag">
                            {formData.etiqueta ||
                              CATEGORIAS_CONFIG[formData.categoria]?.label ||
                              'SERVICIO EXCLUSIVO'}
                          </span>
                          <span className="material-symbols-outlined" style={{ color: '#fed488' }}>
                            {formData.icono || 'auto_awesome'}
                          </span>
                        </div>
                        <h4 className="admin-live-preview-title">
                          {formData.nombre || 'Nombre del Servicio'}
                        </h4>
                        <p className="admin-live-preview-desc">
                          {formData.descripcion ||
                            'Descripción del ritual capilar o de barbería en Nuestra Selección.'}
                        </p>
                        <div className="admin-live-preview-pill">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                            schedule
                          </span>
                          <span>{formData.duracion_min || 60} MIN</span>
                          <span>•</span>
                          <strong>{formatCLP(formData.precio || 0)}</strong>
                        </div>
                      </div>
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
                  id="admin-guardar-servicio-btn"
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
                      <span>{modoModal === 'crear' ? 'Crear Servicio' : 'Guardar Cambios'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Servicio */}
      {servicioAEliminar && (
        <div
          className="admin-modal-overlay"
          onClick={() => !procesandoId && setServicioAEliminar(null)}
          role="presentation"
        >
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-modal-delete-svc-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="admin-modal-icon" aria-hidden="true">
                <span className="material-symbols-outlined">delete_forever</span>
              </div>
              <div>
                <h3 id="admin-modal-delete-svc-title" className="admin-modal-title">
                  ¿Eliminar este servicio del catálogo?
                </h3>
                <p className="admin-modal-subtitle">
                  Dejará de mostrarse inmediatamente en la sección &ldquo;Nuestra Selección&rdquo; y en el módulo de reservas.
                </p>
              </div>
            </div>

            <div className="admin-modal-summary">
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Servicio:</span>
                <strong>{servicioAEliminar.nombre}</strong>
              </div>
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Precio actual:</span>
                <span>{formatCLP(servicioAEliminar.precio)}</span>
              </div>
              <div className="admin-modal-summary-row">
                <span className="admin-modal-summary-label">Duración:</span>
                <span>{servicioAEliminar.duracion_min} minutos</span>
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
                onClick={() => setServicioAEliminar(null)}
                disabled={procesandoId === servicioAEliminar.id}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={confirmarEliminacion}
                disabled={procesandoId === servicioAEliminar.id}
              >
                {procesandoId === servicioAEliminar.id ? (
                  <>
                    <span className="admin-btn-spinner admin-btn-spinner--sm" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  'Eliminar Servicio'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

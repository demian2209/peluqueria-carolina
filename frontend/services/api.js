import { getApiBaseUrl as getBaseUrl } from './apiBase';

/**
 * Fetch con timeout y reintento automático ante reinicios transitorios del proxy/backend
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 7000, retries = 1) {
  const method = (options.method || 'GET').toUpperCase();
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      if (!response.ok && response.status >= 500 && method === 'GET' && attempt < retries) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt < retries && method === 'GET') {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

// MOCK FALLBACK DATA (si el servidor backend no está escuchando)
const FALLBACK_SERVICIOS = [
  {
    id: "s4-balayage",
    nombre: "Balayage & Iluminación Morena",
    descripcion: "Decoloración técnica a mano alzada con protector de enlaces, tonalización de matiz, sellador de cutícula y secado final.",
    duracion_min: 180,
    precio: 85000,
    categoria: "coloracion",
    activo: true,
    en_seleccion: true,
    orden: 1,
    imagen_url: "/images/servicios/servicio_1.webp",
    etiqueta: "Alta Coloración & Iluminación",
    icono: "auto_awesome",
    destacado: true
  },
  {
    id: "s1-corte-mujer",
    nombre: "Corte Mujer + Lavado y Brushing",
    descripcion: "Diagnóstico visual según morfología de rostro, lavado con masaje capilar, corte técnico de autor y secado con movimiento.",
    duracion_min: 50,
    precio: 24990,
    categoria: "corte",
    activo: true,
    en_seleccion: true,
    orden: 2,
    imagen_url: "/images/servicios/servicio_2.webp",
    etiqueta: "Arquitectura Capilar",
    icono: "content_cut",
    destacado: false
  },
  {
    id: "s2-corte-caballero",
    nombre: "Corte Caballero & Fade",
    descripcion: "Corte degradado a tijera o máquina (skin fade/taper), lavado refrescante y peinado con fijación mate.",
    duracion_min: 40,
    precio: 14990,
    categoria: "barberia",
    activo: true,
    en_seleccion: true,
    orden: 3,
    imagen_url: "/images/servicios/servicio_3.webp",
    etiqueta: "Barbería Clásica & Fade",
    icono: "face_6",
    destacado: false
  },
  {
    id: "s3-ritual-barba",
    nombre: "Ritual de Barba Tradicional",
    descripcion: "Perfilado con navaja desechable, aplicación de toallas calientes aromatizadas al vapor, bálsamo y aceite nutritivo.",
    duracion_min: 35,
    precio: 12000,
    categoria: "barberia",
    activo: true,
    en_seleccion: true,
    orden: 4,
    imagen_url: "/images/servicios/servicio_4.webp",
    etiqueta: "Ritual Tradicional & Vapor",
    icono: "spa",
    destacado: false
  },
  {
    id: "s5-coloracion-completa",
    nombre: "Coloración Completa o Retoque de Raíz",
    descripcion: "Aplicación de tintura profesional baja en amoníaco, cobertura total de canas, lavado emoliente y baño de brillo final.",
    duracion_min: 90,
    precio: 38000,
    categoria: "coloracion",
    activo: true,
    en_seleccion: true,
    orden: 5,
    imagen_url: "/images/servicios/servicio_5.webp",
    etiqueta: "Coloración Couture",
    icono: "palette",
    destacado: false
  },
  {
    id: "s6-botox-capilar",
    nombre: "Botox Capilar Antifrizz",
    descripcion: "Relleno molecular termoactivo para sellar cutículas abiertas, eliminar el encrespamiento y aportar brillo espejo sin modificar la onda.",
    duracion_min: 90,
    precio: 45000,
    categoria: "tratamiento",
    activo: true,
    en_seleccion: true,
    orden: 6,
    imagen_url: "/images/servicios/servicio_6.webp",
    etiqueta: "Relleno Molecular Antifrizz",
    icono: "water_drop",
    destacado: false
  },
  {
    id: "s7-alisado-organico",
    nombre: "Alisado Orgánico Vegano",
    descripcion: "Alisado progresivo con base de aminoácidos naturales 100% libre de formol, sellado térmico con plancha de titanio y neutralizado.",
    duracion_min: 150,
    precio: 65000,
    categoria: "tratamiento",
    activo: true,
    en_seleccion: true,
    orden: 7,
    imagen_url: "/images/servicios/servicio_7.webp",
    etiqueta: "Liso Progresivo Vegano",
    icono: "eco",
    destacado: false
  },
  {
    id: "s8-masaje-reparador",
    nombre: "Masaje Reparador Profundo (K18 / Olaplex)",
    descripcion: "Tratamiento intensivo de reconexión de enlaces de queratina para cabellos procesados químicamente, con lavado spa y sellado.",
    duracion_min: 45,
    precio: 32000,
    categoria: "tratamiento",
    activo: true,
    en_seleccion: true,
    orden: 8,
    imagen_url: "/images/servicios/servicio_8.webp",
    etiqueta: "Tecnología Biomimética (K18)",
    icono: "health_and_safety",
    destacado: false
  },
  {
    id: "s9-peinado-social",
    nombre: "Peinado Social & Ondas al Agua",
    descripcion: "Preparación capilar con fijación térmica, elaboración de ondas al agua, semirrecogido o peinado de fiesta para eventos.",
    duracion_min: 60,
    precio: 28000,
    categoria: "styling",
    activo: true,
    en_seleccion: true,
    orden: 9,
    imagen_url: "/images/servicios/servicio_9.webp",
    etiqueta: "Estilismo Editorial & Ondas",
    icono: "auto_awesome",
    destacado: false
  },
  {
    id: "s10-manicura-rusa",
    nombre: "Manicura Rusa & Esmaltado Permanente",
    descripcion: "Limpieza profunda de cutículas con torno, limado anatómico, nivelación de uña natural y esmaltado en gel de larga duración.",
    duracion_min: 60,
    precio: 18990,
    categoria: "manicura",
    activo: true,
    en_seleccion: true,
    orden: 10,
    imagen_url: "/images/servicios/servicio_10.webp",
    etiqueta: "Cuidado & Nivelación Rusa",
    icono: "brush",
    destacado: false
  }
];

const CATALOGO_SYNC_CHANNEL = 'carolina_catalogo_sync';
const CATALOGO_STORAGE_KEY = 'carolina_servicios_updated_at';
const CATALOGO_FALLBACK_KEY = 'carolina_servicios_fallback_store';

const BLOQUEOS_SYNC_CHANNEL = 'carolina_bloqueos_sync';
const BLOQUEOS_STORAGE_KEY = 'carolina_bloqueos_updated_at';
const BLOQUEOS_FALLBACK_KEY = 'carolina_bloqueos_fallback_store';

function obtenerBloqueosFallbackLocal() {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(BLOQUEOS_FALLBACK_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
}

function guardarBloqueosFallbackLocal(lista) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BLOQUEOS_FALLBACK_KEY, JSON.stringify(lista));
  } catch (_) {}
}

/**
 * Emite una señal de sincronización inmediata cuando el Admin crea, edita o elimina un bloqueo horario.
 */
export function notificarActualizacionBloqueos() {
  if (typeof window === 'undefined') return;
  const ts = String(Date.now());
  try {
    localStorage.setItem(BLOQUEOS_STORAGE_KEY, ts);
  } catch (_) {}

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BLOQUEOS_SYNC_CHANNEL);
      bc.postMessage({ type: 'BLOQUEOS_UPDATED', timestamp: ts });
      bc.close();
    }
  } catch (_) {}

  window.dispatchEvent(new CustomEvent('bloqueosHorariosActualizados', { detail: ts }));
}

/**
 * Suscribe un componente (ej. BookingModule) a cambios en los bloqueos horarios del Admin.
 */
export function suscribirActualizacionBloqueos(onUpdate) {
  if (typeof window === 'undefined' || typeof onUpdate !== 'function') {
    return () => {};
  }

  let debounceTimer = null;
  let lastTriggerTs = 0;
  const triggerThrottledUpdate = (immediate = false) => {
    const now = Date.now();
    if (!immediate && now - lastTriggerTs < 2500) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(
      () => {
        lastTriggerTs = Date.now();
        onUpdate();
      },
      immediate ? 60 : 150
    );
  };

  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BLOQUEOS_SYNC_CHANNEL);
      bc.onmessage = (event) => {
        if (event?.data?.type === 'BLOQUEOS_UPDATED') {
          triggerThrottledUpdate(true);
        }
      };
    }
  } catch (_) {}

  const handleStorage = (event) => {
    if (event.key === BLOQUEOS_STORAGE_KEY || event.key === BLOQUEOS_FALLBACK_KEY) {
      triggerThrottledUpdate(true);
    }
  };

  const handleCustom = () => triggerThrottledUpdate(true);
  const handleFocusOrVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      triggerThrottledUpdate(false);
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('bloqueosHorariosActualizados', handleCustom);
  window.addEventListener('focus', handleFocusOrVisibility);
  document.addEventListener('visibilitychange', handleFocusOrVisibility);

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (bc) {
      try {
        bc.close();
      } catch (_) {}
    }
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('bloqueosHorariosActualizados', handleCustom);
    window.removeEventListener('focus', handleFocusOrVisibility);
    document.removeEventListener('visibilitychange', handleFocusOrVisibility);
  };
}

function obtenerFallbackLocal() {
  if (typeof window === 'undefined') return FALLBACK_SERVICIOS;
  try {
    const saved = localStorage.getItem(CATALOGO_FALLBACK_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return FALLBACK_SERVICIOS;
}

function guardarFallbackLocal(lista) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CATALOGO_FALLBACK_KEY, JSON.stringify(lista));
  } catch (_) {}
}

/**
 * Retorna de forma síncrona el catálogo base de "Nuestra Selección" para hidratación inmediata (0ms CLS),
 * evitando saltos de layout o reflows bruscos durante el scroll inicial mientras se revalida con el backend.
 */
export function getServiciosSeleccionInicial() {
  return FALLBACK_SERVICIOS
    .filter((s) => s.activo !== false && s.en_seleccion !== false)
    .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99));
}

/**
 * Emite una señal de revalidación inmediata para que la vista cliente ("Nuestra Selección" y "Reservas")
 * se actualice en tiempo real en la misma pestaña o en otras pestañas abiertas.
 */
export function notificarActualizacionCatalogo() {
  if (typeof window === 'undefined') return;
  const ts = String(Date.now());
  try {
    localStorage.setItem(CATALOGO_STORAGE_KEY, ts);
  } catch (_) {}

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(CATALOGO_SYNC_CHANNEL);
      bc.postMessage({ type: 'SERVICIOS_UPDATED', timestamp: ts });
      bc.close();
    }
  } catch (_) {}

  window.dispatchEvent(new CustomEvent('catalogoServiciosActualizado', { detail: ts }));
}

/**
 * Suscribe un componente a cambios en el catálogo de servicios (desde Admin, otra pestaña o foco de ventana).
 * Retorna la función de limpieza (unsubscribe).
 */
export function suscribirActualizacionCatalogo(onUpdate) {
  if (typeof window === 'undefined' || typeof onUpdate !== 'function') {
    return () => {};
  }

  let debounceTimer = null;
  let lastTriggerTs = 0;
  const triggerThrottledUpdate = (immediate = false) => {
    const now = Date.now();
    if (!immediate && now - lastTriggerTs < 2500) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(
      () => {
        lastTriggerTs = Date.now();
        onUpdate();
      },
      immediate ? 60 : 150
    );
  };

  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(CATALOGO_SYNC_CHANNEL);
      bc.onmessage = (event) => {
        if (event?.data?.type === 'SERVICIOS_UPDATED') {
          triggerThrottledUpdate(true);
        }
      };
    }
  } catch (_) {}

  const handleStorage = (event) => {
    if (event.key === CATALOGO_STORAGE_KEY || event.key === CATALOGO_FALLBACK_KEY) {
      triggerThrottledUpdate(true);
    }
  };

  const handleCustom = () => triggerThrottledUpdate(true);
  const handleFocusOrVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      triggerThrottledUpdate(false);
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('catalogoServiciosActualizado', handleCustom);
  window.addEventListener('focus', handleFocusOrVisibility);
  document.addEventListener('visibilitychange', handleFocusOrVisibility);

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (bc) {
      try {
        bc.close();
      } catch (_) {}
    }
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('catalogoServiciosActualizado', handleCustom);
    window.removeEventListener('focus', handleFocusOrVisibility);
    document.removeEventListener('visibilitychange', handleFocusOrVisibility);
  };
}

const FALLBACK_ESTILISTAS = [
  {
    id: "e1-carolina-valenzuela",
    nombre: "Carolina",
    apellido: "Valenzuela",
    especialidad: "Directora Técnica & Colorista Especialista",
    nivel: "master",
    activo: true,
    orden: 1,
    bio: "Directora Técnica y Colorista Especialista en Balayage & Iluminación Morena y Coloración Completa.",
    foto_url: "/images/maestros_tijera/carolina_valenzuela.webp",
    servicios_ids: ["s4-balayage", "s5-coloracion-completa"]
  },
  {
    id: "e2-matias-munoz",
    nombre: "Matías",
    apellido: "Muñoz",
    especialidad: "Barbero Principal",
    nivel: "artisan",
    activo: true,
    orden: 2,
    bio: "Barbero Principal experto en corte caballero & fade y ritual tradicional de barba a navaja.",
    foto_url: "/images/maestros_tijera/matias_munoz.webp",
    servicios_ids: ["s2-corte-caballero", "s3-ritual-barba"]
  },
  {
    id: "e3-camila-soto",
    nombre: "Camila",
    apellido: "Soto",
    especialidad: "Especialista en Tratamientos Capilares & Alisados",
    nivel: "senior",
    activo: true,
    orden: 3,
    bio: "Especialista en Botox Capilar Antifrizz, Alisado Orgánico Vegano y Masaje K18/Olaplex.",
    foto_url: "/images/maestros_tijera/camila_soto.webp",
    servicios_ids: ["s6-botox-capilar", "s7-alisado-organico", "s8-masaje-reparador"]
  },
  {
    id: "e4-gonzalo-riquelme",
    nombre: "Gonzalo",
    apellido: "Riquelme",
    especialidad: "Estilista Senior & Peinador",
    nivel: "master",
    activo: true,
    orden: 4,
    bio: "Estilista Senior y Peinador, maestro en corte femenino con brushing y peinado social.",
    foto_url: "/images/maestros_tijera/gonzalo_riquelme.webp",
    servicios_ids: ["s1-corte-mujer", "s9-peinado-social"]
  },
  {
    id: "e5-valentina-morales",
    nombre: "Valentina",
    apellido: "Morales",
    especialidad: "Manicurista & Cuidado Integral",
    nivel: "senior",
    activo: true,
    orden: 5,
    bio: "Manicurista profesional y especialista en manicura rusa con torno y esmaltado permanente.",
    foto_url: "/images/maestros_tijera/valentina_morales.webp",
    servicios_ids: ["s10-manicura-rusa"]
  }
];

const EQUIPO_SYNC_CHANNEL = 'carolina_equipo_sync';
const EQUIPO_STORAGE_KEY = 'carolina_equipo_updated_at';
const EQUIPO_FALLBACK_KEY = 'carolina_equipo_fallback_store';

function obtenerEquipoFallbackLocal() {
  if (typeof window === 'undefined') return FALLBACK_ESTILISTAS;
  try {
    const saved = localStorage.getItem(EQUIPO_FALLBACK_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return FALLBACK_ESTILISTAS;
}

function guardarEquipoFallbackLocal(lista) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EQUIPO_FALLBACK_KEY, JSON.stringify(lista));
  } catch (_) {}
}

/**
 * Emite una señal de sincronización inmediata cuando el Admin crea, edita, oculta o elimina un miembro del equipo.
 */
export function notificarActualizacionEquipo() {
  if (typeof window === 'undefined') return;
  const ts = String(Date.now());
  try {
    localStorage.setItem(EQUIPO_STORAGE_KEY, ts);
  } catch (_) {}

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(EQUIPO_SYNC_CHANNEL);
      bc.postMessage({ type: 'EQUIPO_UPDATED', timestamp: ts });
      bc.close();
    }
  } catch (_) {}

  window.dispatchEvent(new CustomEvent('equipoActualizado', { detail: ts }));
}

/**
 * Suscribe un componente (ej. TeamSection, BookingModule) a cambios en el equipo desde el Panel Admin.
 */
export function suscribirActualizacionEquipo(onUpdate) {
  if (typeof window === 'undefined' || typeof onUpdate !== 'function') {
    return () => {};
  }

  let debounceTimer = null;
  let lastTriggerTs = 0;
  const triggerThrottledUpdate = (immediate = false) => {
    const now = Date.now();
    if (!immediate && now - lastTriggerTs < 2500) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(
      () => {
        lastTriggerTs = Date.now();
        onUpdate();
      },
      immediate ? 60 : 150
    );
  };

  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(EQUIPO_SYNC_CHANNEL);
      bc.onmessage = (event) => {
        if (event?.data?.type === 'EQUIPO_UPDATED') {
          triggerThrottledUpdate(true);
        }
      };
    }
  } catch (_) {}

  const handleStorage = (event) => {
    if (event.key === EQUIPO_STORAGE_KEY || event.key === EQUIPO_FALLBACK_KEY) {
      triggerThrottledUpdate(true);
    }
  };

  const handleCustom = () => triggerThrottledUpdate(true);
  const handleFocusOrVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      triggerThrottledUpdate(false);
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('equipoActualizado', handleCustom);
  window.addEventListener('focus', handleFocusOrVisibility);
  document.addEventListener('visibilitychange', handleFocusOrVisibility);

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (bc) {
      try {
        bc.close();
      } catch (_) {}
    }
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('equipoActualizado', handleCustom);
    window.removeEventListener('focus', handleFocusOrVisibility);
    document.removeEventListener('visibilitychange', handleFocusOrVisibility);
  };
}

const DIAS_SEMANA_NOMBRES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

// Matriz oficial de días y horarios de atención por estilista
const HORARIOS_ESTILISTAS_CANONICOS = {
  'e1-carolina-valenzuela': {
    nombre: 'Carolina Valenzuela',
    dias: [1, 2, 3, 4, 5, 6],
    hora_inicio: '09:00',
    hora_fin: '18:00',
    diasAtencionTexto: 'Lunes a Sábado (09:00 a 18:00 hs)',
  },
  'e2-matias-munoz': {
    nombre: 'Matías Muñoz',
    dias: [1, 2, 3, 4, 5, 6],
    hora_inicio: '09:00',
    hora_fin: '17:00',
    diasAtencionTexto: 'Lunes a Sábado (09:00 a 17:00 hs)',
  },
  'e3-camila-soto': {
    nombre: 'Camila Soto',
    dias: [2, 3, 4, 5, 6],
    hora_inicio: '10:00',
    hora_fin: '19:00',
    diasAtencionTexto: 'Martes a Sábado (10:00 a 19:00 hs)',
  },
  'e4-gonzalo-riquelme': {
    nombre: 'Gonzalo Riquelme',
    dias: [1, 2, 3, 4, 5],
    hora_inicio: '10:00',
    hora_fin: '19:00',
    diasAtencionTexto: 'Lunes a Viernes (10:00 a 19:00 hs)',
  },
  'e5-valentina-morales': {
    nombre: 'Valentina Morales',
    dias: [3, 4, 5, 6, 0],
    hora_inicio: '10:00',
    hora_fin: '18:00',
    diasAtencionTexto: 'Miércoles a Domingo (10:00 a 18:00 hs)',
  },
};

function resolverClaveEstilista(estilista_id = '', estilista_nombre = '') {
  const idStr = String(estilista_id || '').trim();
  const idMap = {
    '1': 'e1-carolina-valenzuela',
    '2': 'e2-matias-munoz',
    '3': 'e3-camila-soto',
    '4': 'e4-gonzalo-riquelme',
    '5': 'e5-valentina-morales',
  };
  if (idMap[idStr]) return idMap[idStr];
  if (HORARIOS_ESTILISTAS_CANONICOS[idStr]) return idStr;

  const norm = `${idStr} ${estilista_nombre || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('carolina')) return 'e1-carolina-valenzuela';
  if (norm.includes('matias')) return 'e2-matias-munoz';
  if (norm.includes('camila')) return 'e3-camila-soto';
  if (norm.includes('gonzalo')) return 'e4-gonzalo-riquelme';
  if (norm.includes('valentina')) return 'e5-valentina-morales';

  return 'e1-carolina-valenzuela';
}

export function resolverDuracionServicio(servicio_id = '', duracion_min = 0, listaServicios = []) {
  const explicit = Number(duracion_min);
  if (explicit && explicit > 0) return explicit;

  const idStr = String(servicio_id || '').trim();
  const svcMockMap = {
    '1': 's1-corte-mujer',
    '2': 's1-corte-mujer',
    '3': 's5-coloracion-completa',
    '4': 's4-balayage',
    '5': 's3-ritual-barba',
    '6': 's2-corte-caballero',
    '7': 's6-botox-capilar',
    '8': 's7-alisado-organico',
    '9': 's8-masaje-reparador',
    '10': 's9-peinado-social',
    '11': 's10-manicura-rusa',
  };
  const mappedId = svcMockMap[idStr] || idStr;

  const pools = [
    ...(Array.isArray(listaServicios) ? listaServicios : []),
    ...obtenerFallbackLocal(),
    ...FALLBACK_SERVICIOS,
  ];

  const found = pools.find(
    (s) => s && (String(s.id) === idStr || String(s.id) === mappedId)
  );
  if (found && Number(found.duracion_min) > 0) {
    return Number(found.duracion_min);
  }

  return 180; // Default al primer servicio destacado (Balayage 180 min) si aún no se ha seleccionado otro
}

/**
 * Evalúa si el estilista trabaja en la fecha indicada ("YYYY-MM-DD") y devuelve
 * metadatos de su jornada laboral para mostrar mensajes informativos en el formulario.
 */
export function obtenerInfoHorarioEstilista(estilista_id = '', estilista_nombre = '', fecha = '') {
  const key = resolverClaveEstilista(estilista_id, estilista_nombre);
  const cfg = HORARIOS_ESTILISTAS_CANONICOS[key] || HORARIOS_ESTILISTAS_CANONICOS['e1-carolina-valenzuela'];

  let trabajaEseDia = true;
  let nombreDia = '';

  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [year, month, day] = fecha.split('-').map(Number);
    const diaSemana = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    nombreDia = DIAS_SEMANA_NOMBRES[diaSemana] || '';
    trabajaEseDia = cfg.dias.includes(diaSemana);
  }

  return {
    estilistaKey: key,
    estilistaNombre: estilista_nombre || cfg.nombre,
    trabajaEseDia,
    nombreDia,
    diasAtencionTexto: cfg.diasAtencionTexto,
    hora_inicio: cfg.hora_inicio,
    hora_fin: cfg.hora_fin,
  };
}

/**
 * Calcula los bloques horarios de un servicio según su duración real demarcada en "Nuestra Selección"
 * y el horario laboral del estilista asignado.
 */
export function calcularSlotsPorServicio({
  estilista_id = '',
  estilista_nombre = '',
  servicio_id = '',
  duracion_min = 0,
  fecha = '',
  filtrarReloj = false,
  listaServicios = [],
} = {}) {
  const info = obtenerInfoHorarioEstilista(estilista_id, estilista_nombre, fecha);
  const duracion = resolverDuracionServicio(servicio_id, duracion_min, listaServicios);

  if (fecha && !info.trabajaEseDia) {
    return {
      slots: [],
      trabajaEseDia: false,
      duracionMin: duracion,
      nombreDia: info.nombreDia,
      diasAtencionTexto: info.diasAtencionTexto,
      estilistaNombre: info.estilistaNombre,
    };
  }

  const [iniH, iniM] = info.hora_inicio.split(':').map(Number);
  const [finH, finM] = info.hora_fin.split(':').map(Number);
  const workStart = iniH * 60 + iniM;
  const workEnd = finH * 60 + finM;
  const pad = (n) => String(n).padStart(2, '0');

  const rawSlots = [];
  for (let start = workStart; start + duracion <= workEnd; start += duracion) {
    const hh = Math.floor(start / 60);
    const mm = start % 60;
    rawSlots.push(`${pad(hh)}:${pad(mm)}`);
  }

  const slots = filtrarReloj && fecha
    ? filtrarHorariosSegunRelojSistema(rawSlots, fecha)
    : rawSlots;

  return {
    slots,
    trabajaEseDia: true,
    duracionMin: duracion,
    nombreDia: info.nombreDia,
    diasAtencionTexto: info.diasAtencionTexto,
    estilistaNombre: info.estilistaNombre,
  };
}

/**
 * Obtiene la fecha ("YYYY-MM-DD") y hora ("HH:MM", minutos desde medianoche)
 * actual del reloj del sistema.
 */
export function obtenerFechaHoraSistemaCliente() {
  const ahora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fechaHoy = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;
  const horas = ahora.getHours();
  const minutos = ahora.getMinutes();
  const horaActual = `${pad(horas)}:${pad(minutos)}`;
  return {
    fechaHoy,
    horaActual,
    minutosActuales: horas * 60 + minutos,
  };
}

/**
 * Filtra estrictamente los bloques horarios cuando la fecha consultada es hoy (o no se ha seleccionado fecha).
 * Prohibido listar o sugerir horarios <= a la hora actual del sistema en el mismo día.
 */
export function filtrarHorariosSegunRelojSistema(slots = [], fecha = '') {
  if (!Array.isArray(slots)) return [];
  const { fechaHoy, minutosActuales } = obtenerFechaHoraSistemaCliente();
  const fechaEvaluada = fecha || fechaHoy;

  if (fechaEvaluada < fechaHoy) return [];
  if (fechaEvaluada > fechaHoy) return slots;

  return slots.filter((slot) => {
    const [hh, mm] = String(slot || '').split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return false;
    return hh * 60 + mm > minutosActuales;
  });
}

/**
 * Obtener lista de servicios activos desde la API (para reservas y vistas generales)
 */
export async function getServicios(categoria = '') {
  try {
    const baseUrl = getBaseUrl();
    const qs = new URLSearchParams();
    if (categoria) qs.set('categoria', categoria);
    qs.set('_t', String(Date.now()));
    const url = `${baseUrl}/servicios?${qs.toString()}`;
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 7000);
    if (!res.ok) throw new Error('Error al obtener servicios');
    const json = await res.json();
    if (Array.isArray(json.data)) {
      if (!categoria && json.data.length > 0) {
        guardarFallbackLocal(json.data);
      }
      return json.data;
    }
    return obtenerFallbackLocal().filter((s) => s.activo !== false);
  } catch (err) {
    console.warn('Backend API inaccesible, usando fallback local para servicios:', err.message);
    const local = obtenerFallbackLocal().filter((s) => s.activo !== false);
    if (categoria) {
      return local.filter((s) => String(s.categoria || '').toLowerCase() === categoria.toLowerCase());
    }
    return local;
  }
}

/**
 * Obtener lista optimizada de servicios pertenecientes a "Nuestra Selección" (Landing Page)
 */
export async function getServiciosSeleccion(categoria = '') {
  try {
    const baseUrl = getBaseUrl();
    const qs = new URLSearchParams();
    if (categoria && categoria !== 'all') qs.set('categoria', categoria);
    qs.set('_t', String(Date.now()));
    const url = `${baseUrl}/servicios/seleccion?${qs.toString()}`;
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 7000);
    if (!res.ok) throw new Error('Error al obtener servicios de Nuestra Selección');
    const json = await res.json();
    if (Array.isArray(json.data)) {
      if ((!categoria || categoria === 'all') && json.data.length > 0) {
        guardarFallbackLocal(json.data);
      }
      return json.data;
    }
    return obtenerFallbackLocal().filter((s) => s.activo !== false && s.en_seleccion !== false);
  } catch (err) {
    console.warn('Backend API inaccesible, usando fallback local para Nuestra Selección:', err.message);
    return obtenerFallbackLocal()
      .filter((s) => s.activo !== false && s.en_seleccion !== false)
      .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99));
  }
}

/**
 * Obtener todos los servicios (incluyendo pausados/ocultos) para el Panel de Administración
 */
export async function getServiciosAdmin(headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/servicios?incluir_inactivos=true&_t=${Date.now()}`,
      {
        cache: 'no-store',
        headers: { ...headers },
      },
      7000
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al cargar catálogo de servicios');
    if (Array.isArray(json.data)) {
      guardarFallbackLocal(json.data);
      return json.data;
    }
    return obtenerFallbackLocal();
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      return obtenerFallbackLocal();
    }
    throw err;
  }
}

/**
 * Crear un nuevo servicio desde el Panel de Administración
 */
export async function crearServicioAdmin(payload, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/servicios`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      },
      8000,
      0
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al crear servicio');
    if (json.data) {
      const current = obtenerFallbackLocal().filter((s) => String(s.id) !== String(json.data.id));
      guardarFallbackLocal([...current, json.data]);
    }
    notificarActualizacionCatalogo();
    return json.data;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const current = obtenerFallbackLocal();
      const maxOrden = current.reduce((m, s) => Math.max(m, Number(s.orden || 0)), 0);
      const nuevo = {
        id: `s-${Date.now().toString(36)}`,
        nombre: payload.nombre,
        descripcion: payload.descripcion || '',
        duracion_min: Number(payload.duracion_min || 45),
        precio: Number(payload.precio || 0),
        categoria: payload.categoria || 'coloracion',
        activo: payload.activo !== undefined ? Boolean(payload.activo) : true,
        en_seleccion: payload.en_seleccion !== undefined ? Boolean(payload.en_seleccion) : true,
        orden: payload.orden ? Number(payload.orden) : maxOrden + 1,
        imagen_url: payload.imagen_base64 || payload.imagen_url || '/images/servicios/servicio_1.webp',
        etiqueta: payload.etiqueta || 'Servicio Exclusivo',
        icono: payload.icono || 'auto_awesome',
        destacado: Boolean(payload.destacado),
      };
      const updated = [...current, nuevo];
      guardarFallbackLocal(updated);
      notificarActualizacionCatalogo();
      return nuevo;
    }
    throw err;
  }
}

/**
 * Actualizar un servicio existente (PUT/PATCH) desde el Panel de Administración
 */
export async function actualizarServicioAdmin(id, payload, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/servicios/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      },
      8000,
      0
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al actualizar servicio');
    if (json.data) {
      const current = obtenerFallbackLocal().map((s) =>
        String(s.id) === String(id) ? { ...s, ...json.data } : s
      );
      guardarFallbackLocal(current);
    }
    notificarActualizacionCatalogo();
    return json.data;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const current = obtenerFallbackLocal();
      let updatedItem = null;
      const updated = current.map((s) => {
        if (String(s.id) !== String(id)) return s;
        updatedItem = {
          ...s,
          ...payload,
          ...(payload.precio !== undefined ? { precio: Number(payload.precio) } : {}),
          ...(payload.duracion_min !== undefined ? { duracion_min: Number(payload.duracion_min) } : {}),
          ...(payload.orden !== undefined ? { orden: Number(payload.orden) } : {}),
          ...(payload.imagen_base64 ? { imagen_url: payload.imagen_base64 } : {}),
        };
        return updatedItem;
      });
      guardarFallbackLocal(updated);
      notificarActualizacionCatalogo();
      return updatedItem;
    }
    throw err;
  }
}

/**
 * Conmutar rápidamente la visibilidad de un servicio en "Nuestra Selección" o su estado activo
 */
export async function toggleVisibilidadServicioAdmin(id, payload, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/servicios/${encodeURIComponent(id)}/visibilidad`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      },
      6000,
      0
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al cambiar visibilidad del servicio');
    if (json.data) {
      const current = obtenerFallbackLocal().map((s) =>
        String(s.id) === String(id) ? { ...s, ...json.data } : s
      );
      guardarFallbackLocal(current);
    }
    notificarActualizacionCatalogo();
    return json.data;
  } catch (err) {
    return actualizarServicioAdmin(id, payload, headers);
  }
}

/**
 * Eliminar un servicio desde el Panel de Administración
 */
export async function eliminarServicioAdmin(id, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/servicios/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: { ...headers },
      },
      6000,
      0
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al eliminar servicio');
    const current = obtenerFallbackLocal().filter((s) => String(s.id) !== String(id));
    guardarFallbackLocal(current);
    notificarActualizacionCatalogo();
    return json;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const current = obtenerFallbackLocal().filter((s) => String(s.id) !== String(id));
      guardarFallbackLocal(current);
      notificarActualizacionCatalogo();
      return { status: 'success', data: { id } };
    }
    throw err;
  }
}

/**
 * Obtener lista de estilistas visibles/activos desde la API (para landing page y reservas)
 */
export async function getEstilistas(nivel = '') {
  try {
    const baseUrl = getBaseUrl();
    const qs = new URLSearchParams();
    if (nivel) qs.set('nivel', nivel);
    qs.set('_t', String(Date.now()));
    const url = `${baseUrl}/estilistas?${qs.toString()}`;
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 7000);
    if (!res.ok) throw new Error('Error al obtener estilistas');
    const json = await res.json();
    if (Array.isArray(json.data)) {
      if (!nivel) {
        guardarEquipoFallbackLocal(json.data);
      }
      return json.data;
    }
    return obtenerEquipoFallbackLocal().filter((e) => e.activo !== false);
  } catch (err) {
    console.warn('Backend API inaccesible, usando fallback local para estilistas:', err.message);
    const local = obtenerEquipoFallbackLocal()
      .filter((e) => e.activo !== false)
      .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99));
    if (nivel) {
      return local.filter((e) => String(e.nivel || '').toLowerCase() === nivel.toLowerCase());
    }
    return local;
  }
}

/**
 * Obtener todos los miembros del equipo (visibles y ocultos) para el Panel de Administración
 */
export async function getEstilistasAdmin(headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/estilistas?incluir_inactivos=true&_t=${Date.now()}`,
      {
        cache: 'no-store',
        headers: { ...headers },
      },
      7000
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al cargar el equipo');
    if (Array.isArray(json.data)) {
      guardarEquipoFallbackLocal(json.data);
      return json.data;
    }
    return obtenerEquipoFallbackLocal();
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      return obtenerEquipoFallbackLocal();
    }
    throw err;
  }
}

/**
 * Crear un nuevo miembro del equipo desde el Panel de Administración
 */
export async function crearEstilistaAdmin(payload, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/estilistas`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      },
      8000,
      0
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al crear miembro del equipo');
    if (json.data) {
      const current = obtenerEquipoFallbackLocal().filter((e) => String(e.id) !== String(json.data.id));
      guardarEquipoFallbackLocal([...current, json.data]);
    }
    notificarActualizacionEquipo();
    return json.data;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const current = obtenerEquipoFallbackLocal();
      const maxOrden = current.reduce((m, e) => Math.max(m, Number(e.orden || 0)), 0);
      const nuevo = {
        id: `e-${Date.now().toString(36)}`,
        nombre: payload.nombre,
        apellido: payload.apellido || '',
        especialidad: payload.especialidad || 'Estilista Profesional',
        bio: payload.bio || payload.descripcion || '',
        nivel: payload.nivel || 'senior',
        activo: payload.activo !== undefined ? Boolean(payload.activo) : true,
        orden: payload.orden ? Number(payload.orden) : maxOrden + 1,
        foto_url: payload.imagen_base64 || payload.foto_url || '/images/maestros_tijera/carolina_valenzuela.webp',
        servicios_ids: Array.isArray(payload.servicios_ids) ? payload.servicios_ids : [],
      };
      guardarEquipoFallbackLocal([...current, nuevo]);
      notificarActualizacionEquipo();
      return nuevo;
    }
    throw err;
  }
}

/**
 * Actualizar un miembro del equipo existente (PATCH) desde el Panel de Administración
 */
export async function actualizarEstilistaAdmin(id, payload, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/estilistas/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      },
      8000,
      0
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al actualizar miembro del equipo');
    if (json.data) {
      const current = obtenerEquipoFallbackLocal().map((e) =>
        String(e.id) === String(id) ? { ...e, ...json.data } : e
      );
      guardarEquipoFallbackLocal(current);
    }
    notificarActualizacionEquipo();
    return json.data;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const current = obtenerEquipoFallbackLocal();
      let updatedItem = null;
      const updated = current.map((e) => {
        if (String(e.id) !== String(id)) return e;
        updatedItem = {
          ...e,
          ...payload,
          ...(payload.orden !== undefined ? { orden: Number(payload.orden) } : {}),
          ...(payload.imagen_base64 ? { foto_url: payload.imagen_base64 } : {}),
        };
        return updatedItem;
      });
      guardarEquipoFallbackLocal(updated);
      notificarActualizacionEquipo();
      return updatedItem;
    }
    throw err;
  }
}

/**
 * Conmutar rápidamente la visibilidad de un miembro del equipo
 */
export async function toggleVisibilidadEstilistaAdmin(id, payload, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/estilistas/${encodeURIComponent(id)}/visibilidad`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      },
      6000,
      0
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al cambiar visibilidad del miembro');
    if (json.data) {
      const current = obtenerEquipoFallbackLocal().map((e) =>
        String(e.id) === String(id) ? { ...e, ...json.data } : e
      );
      guardarEquipoFallbackLocal(current);
    }
    notificarActualizacionEquipo();
    return json.data;
  } catch (err) {
    return actualizarEstilistaAdmin(id, payload, headers);
  }
}

/**
 * Eliminar un miembro del equipo desde el Panel de Administración
 */
export async function eliminarEstilistaAdmin(id, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/estilistas/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: { ...headers },
      },
      6000,
      0
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al eliminar miembro del equipo');
    const current = obtenerEquipoFallbackLocal().filter((e) => String(e.id) !== String(id));
    guardarEquipoFallbackLocal(current);
    notificarActualizacionEquipo();
    return json;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const current = obtenerEquipoFallbackLocal().filter((e) => String(e.id) !== String(id));
      guardarEquipoFallbackLocal(current);
      notificarActualizacionEquipo();
      return { status: 'success', data: { id } };
    }
    throw err;
  }
}

/**
 * Retorna la matriz canónica de días y horarios de atención de los estilistas.
 */
export function obtenerHorariosCanónicosEstilistas() {
  return HORARIOS_ESTILISTAS_CANONICOS;
}

/**
 * Resuelve la clave canónica de un estilista ("e1-carolina-valenzuela", etc.) o "todos".
 */
export function resolverClaveEstilistaPublica(estilista_id = '', estilista_nombre = '') {
  if (!estilista_id || String(estilista_id).trim().toLowerCase() === 'todos') {
    return 'todos';
  }
  return resolverClaveEstilista(estilista_id, estilista_nombre);
}

/**
 * Aplica bloqueos almacenados localmente (modo offline/fallback) sobre una lista de slots.
 */
function aplicarBloqueosLocalesASlots({ slots, estilista_id, estilista_nombre, fecha, duracionMin }) {
  const todos = obtenerBloqueosFallbackLocal().filter((b) => b && b.activo !== false);
  if (!fecha || todos.length === 0) {
    return { slots, bloqueadoDiaCompleto: false, motivoBloqueo: null };
  }

  const estKey = resolverClaveEstilista(estilista_id, estilista_nombre);
  const [y, m, d] = fecha.split('-').map(Number);
  const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const aplicables = todos.filter((b) => {
    const matchEst = b.estilista_id === 'todos' || b.estilista_id === estKey;
    if (!matchEst) return false;
    if (b.tipo === 'fecha') return b.fecha === fecha;
    if (b.tipo === 'recurrente') return Number(b.dia_semana) === diaSemana;
    return false;
  });

  const fullDay = aplicables.find((b) => b.dia_completo === true);
  if (fullDay) {
    return {
      slots: [],
      bloqueadoDiaCompleto: true,
      motivoBloqueo: fullDay.motivo || 'Día bloqueado por administración',
    };
  }

  const toMin = (t) => {
    const [hh, mm] = String(t || '00:00').split(':').map(Number);
    return hh * 60 + mm;
  };

  const parciales = aplicables
    .filter((b) => !b.dia_completo && b.hora_inicio && b.hora_fin)
    .map((b) => ({ start: toMin(b.hora_inicio), end: toMin(b.hora_fin) }));

  if (parciales.length === 0) {
    return { slots, bloqueadoDiaCompleto: false, motivoBloqueo: null };
  }

  const dur = Number(duracionMin) || 45;
  const filtrados = slots.filter((slot) => {
    const sStart = toMin(slot);
    const sEnd = sStart + dur;
    return parciales.every((b) => sEnd <= b.start || sStart >= b.end);
  });

  return { slots: filtrados, bloqueadoDiaCompleto: false, motivoBloqueo: null };
}

/**
 * Obtiene disponibilidad detallada incluyendo información de bloqueos administrativos
 * de día completo (para mostrar mensajes claros al usuario en el formulario de reservas).
 */
export async function getDisponibilidadDetallada({
  estilista_id,
  estilista_nombre = '',
  fecha,
  servicio_id,
  duracion_min = 0,
  listaServicios = [],
}) {
  const duracion = resolverDuracionServicio(servicio_id, duracion_min, listaServicios);
  const infoHorario = obtenerInfoHorarioEstilista(estilista_id, estilista_nombre, fecha);

  if (fecha && !infoHorario.trabajaEseDia) {
    return {
      slots: [],
      trabajaEseDia: false,
      bloqueadoDiaCompleto: false,
      motivoBloqueo: null,
    };
  }

  try {
    if (!estilista_id || !fecha || !servicio_id) {
      const local = calcularSlotsPorServicio({
        estilista_id,
        estilista_nombre,
        servicio_id,
        duracion_min: duracion,
        fecha,
        filtrarReloj: Boolean(fecha),
        listaServicios,
      });
      return {
        slots: local.slots,
        trabajaEseDia: local.trabajaEseDia,
        bloqueadoDiaCompleto: false,
        motivoBloqueo: null,
      };
    }

    const baseUrl = getBaseUrl();
    const qs = new URLSearchParams({
      estilista_id: String(estilista_id),
      fecha: String(fecha),
      servicio_id: String(servicio_id),
      duracion_min: String(duracion),
      intervalo_min: String(duracion),
      _t: String(Date.now()),
    });

    const url = `${baseUrl}/disponibilidad?${qs.toString()}`;
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 7000);
    if (!res.ok) throw new Error('Error al obtener disponibilidad');
    const json = await res.json();

    if (json.data?.trabaja_ese_dia === false) {
      return {
        slots: [],
        trabajaEseDia: false,
        bloqueadoDiaCompleto: false,
        motivoBloqueo: null,
      };
    }

    if (json.data?.bloqueado_dia_completo === true) {
      return {
        slots: [],
        trabajaEseDia: true,
        bloqueadoDiaCompleto: true,
        motivoBloqueo: json.data?.motivo_bloqueo || 'Día bloqueado por administración',
      };
    }

    const apiSlots = json.data?.slots_disponibles || [];
    return {
      slots: filtrarHorariosSegunRelojSistema(apiSlots, fecha),
      trabajaEseDia: true,
      bloqueadoDiaCompleto: false,
      motivoBloqueo: null,
    };
  } catch (err) {
    console.warn('Backend API inaccesible, usando cálculo local por duración de servicio:', err.message);
    const local = calcularSlotsPorServicio({
      estilista_id,
      estilista_nombre,
      servicio_id,
      duracion_min: duracion,
      fecha,
      filtrarReloj: Boolean(fecha),
      listaServicios,
    });
    const conBloqueos = aplicarBloqueosLocalesASlots({
      slots: local.slots,
      estilista_id,
      estilista_nombre,
      fecha,
      duracionMin: duracion,
    });
    return {
      slots: conBloqueos.slots,
      trabajaEseDia: local.trabajaEseDia,
      bloqueadoDiaCompleto: conBloqueos.bloqueadoDiaCompleto,
      motivoBloqueo: conBloqueos.motivoBloqueo,
    };
  }
}

/**
 * Obtener slots de disponibilidad para estilista, fecha y servicio.
 * Ajusta el intervalo de los bloques exactamente a la duración del servicio (`duracion_min`)
 * demarcada en la sección "Nuestra Selección".
 */
export async function getDisponibilidad(params) {
  const result = await getDisponibilidadDetallada(params);
  return result.slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMINISTRACIÓN DE BLOQUEOS DE HORAS Y HORARIOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Listar bloqueos horarios desde el Panel de Administración
 */
export async function getBloqueosAdmin(headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/bloqueos?_t=${Date.now()}`,
      {
        cache: 'no-store',
        headers: { ...headers },
      },
      5000
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al cargar bloqueos horarios');
    if (Array.isArray(json.data)) {
      guardarBloqueosFallbackLocal(json.data);
      return json.data;
    }
    return obtenerBloqueosFallbackLocal();
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      return obtenerBloqueosFallbackLocal();
    }
    throw err;
  }
}

/**
 * Crear un nuevo bloqueo horario desde el Panel de Administración
 */
export async function crearBloqueoAdmin(payload, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/bloqueos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      },
      6000
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al crear el bloqueo horario');
    notificarActualizacionBloqueos();
    return json.data;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const current = obtenerBloqueosFallbackLocal();
      const nuevo = {
        id: `blq-${Date.now().toString(36)}`,
        estilista_id: resolverClaveEstilistaPublica(payload.estilista_id),
        tipo: payload.tipo === 'recurrente' ? 'recurrente' : 'fecha',
        fecha: payload.tipo === 'fecha' ? payload.fecha : null,
        dia_semana: payload.tipo === 'recurrente' ? Number(payload.dia_semana) : null,
        dia_completo: Boolean(payload.dia_completo),
        hora_inicio: payload.dia_completo ? null : payload.hora_inicio,
        hora_fin: payload.dia_completo ? null : payload.hora_fin,
        motivo: payload.motivo || '',
        activo: true,
        created_at: new Date().toISOString(),
      };
      guardarBloqueosFallbackLocal([nuevo, ...current]);
      notificarActualizacionBloqueos();
      return nuevo;
    }
    throw err;
  }
}

/**
 * Actualizar o pausar/reactivar un bloqueo horario existente
 */
export async function actualizarBloqueoAdmin(id, payload, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/bloqueos/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      },
      6000
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al actualizar el bloqueo horario');
    notificarActualizacionBloqueos();
    return json.data;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const current = obtenerBloqueosFallbackLocal();
      let updatedItem = null;
      const updated = current.map((b) => {
        if (String(b.id) !== String(id)) return b;
        updatedItem = { ...b, ...payload };
        return updatedItem;
      });
      guardarBloqueosFallbackLocal(updated);
      notificarActualizacionBloqueos();
      return updatedItem;
    }
    throw err;
  }
}

/**
 * Eliminar un bloqueo horario desde el Panel de Administración
 */
export async function eliminarBloqueoAdmin(id, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/bloqueos/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: { ...headers },
      },
      6000
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al eliminar el bloqueo horario');
    notificarActualizacionBloqueos();
    return json;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const current = obtenerBloqueosFallbackLocal().filter((b) => String(b.id) !== String(id));
      guardarBloqueosFallbackLocal(current);
      notificarActualizacionBloqueos();
      return { status: 'success', data: { id } };
    }
    throw err;
  }
}

/**
 * Enviar solicitud de reserva a la API
 */
export async function postReserva(bookingData) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(`${baseUrl}/reservas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData),
    }, 6000);

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || 'Error al procesar la reserva');
    }

    return json;
  } catch (err) {
    // Si la API falla por conexión, generamos una respuesta de confirmación mock estructurada
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      const randId = Math.floor(10 + Math.random() * 89);
      const randSuffix = Math.floor(1000 + Math.random() * 8999).toString(36).toUpperCase().slice(-4);
      return {
        status: 'success',
        source: 'client_fallback',
        data: {
          id: `RES-${randId}`,
          codigo_reserva: `PC-${randId}-${randSuffix}`,
          cliente_nombre: bookingData.cliente_nombre,
          cliente_email: bookingData.cliente_email,
          cliente_telefono: bookingData.cliente_telefono,
          fecha: bookingData.fecha,
          hora_inicio: bookingData.hora_inicio,
          estado: 'pendiente',
        },
      };
    }
    throw err;
  }
}

/**
 * Consultar estado de una reserva para autogestión del cliente (Token HMAC o Verificación de Contacto)
 */
export async function getReservaCliente(id, { contacto = '', token = '' } = {}) {
  const baseUrl = getBaseUrl();
  const cleanId = String(id).replace(/^#/, '').trim();
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (contacto) params.set('contacto', contacto.trim());
  const qs = params.toString() ? `?${params.toString()}` : '';

  const res = await fetchWithTimeout(`${baseUrl}/reservas/${encodeURIComponent(cleanId)}${qs}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      ...(token ? { 'x-reserva-token': token } : {}),
    },
  }, 5000);

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'No se pudo consultar la reserva.');
  }
  return json.data;
}

/**
 * Cancelar una reserva por parte del cliente (dispara evento n8n WhatsApp/Email y libera horario)
 */
export async function cancelarReservaCliente(id, { contacto = '', token = '' } = {}) {
  const baseUrl = getBaseUrl();
  const cleanId = String(id).replace(/^#/, '').trim();

  const res = await fetchWithTimeout(`${baseUrl}/reservas/${encodeURIComponent(cleanId)}/cancelar`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-reserva-token': token } : {}),
    },
    body: JSON.stringify({
      ...(token ? { token } : {}),
      ...(contacto ? { contacto: contacto.trim() } : {}),
    }),
  }, 6000);

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'No se pudo cancelar la reserva.');
  }
  return json;
}

/**
 * Reprogramar una reserva por parte del cliente (dispara evento n8n WhatsApp/Email y actualiza horario)
 */
export async function reprogramarReservaCliente(id, { fecha, hora_inicio, notas, contacto = '', token = '' } = {}) {
  const baseUrl = getBaseUrl();
  const cleanId = String(id).replace(/^#/, '').trim();

  const res = await fetchWithTimeout(`${baseUrl}/reservas/${encodeURIComponent(cleanId)}/reprogramar`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-reserva-token': token } : {}),
    },
    body: JSON.stringify({
      fecha,
      hora_inicio,
      ...(notas !== undefined ? { notas } : {}),
      ...(token ? { token } : {}),
      ...(contacto ? { contacto: contacto.trim() } : {}),
    }),
  }, 6000);

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'No se pudo reprogramar la reserva.');
  }
  return json;
}

/**
 * Enviar mensaje al Asistente Virtual IA (a través del backend con rate limit)
 */
export async function enviarConsultaAsistente(mensaje) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(`${baseUrl}/asistente/consulta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mensaje }),
    }, 10000);

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || 'Error al comunicarse con el asistente');
    }

    return json.data?.respuesta || json.respuesta || 'No se obtuvo respuesta del asistente.';
  } catch (err) {
    console.error('Error al consultar asistente:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMINISTRACIÓN DE ENCUESTAS DE SATISFACCIÓN
// ─────────────────────────────────────────────────────────────────────────────

const ENCUESTAS_SYNC_CHANNEL = 'carolina_encuestas_sync';
const ENCUESTAS_STORAGE_KEY = 'carolina_encuestas_updated_at';
const ENCUESTAS_FALLBACK_KEY = 'carolina_encuestas_fallback_store';

const FALLBACK_ENCUESTAS = [
  {
    id: 'enc-seed-1',
    reserva_id: 'r1',
    codigo_reserva: 'PC-R1-0900',
    puntaje: 5,
    comentario:
      '¡Increíble atención! Carolina logró exactamente el tono de balayage que buscaba y mi cabello quedó súper suave y brillante.',
    respondida_en: '2026-11-18T19:30:00.000Z',
    cliente_nombre: 'Constanza Morales',
    cliente_email: 'constanza.morales@ejemplo.cl',
    cliente_telefono: '+56984123456',
    servicio_id: 's4-balayage',
    servicio_nombre: 'Balayage & Iluminación Morena',
    estilista_id: 'e1-carolina-valenzuela',
    estilista_nombre: 'Carolina Valenzuela',
    estilista_especialidad: 'Directora Técnica & Colorista Especialista',
    fecha_cita: '2026-11-18',
    hora_inicio: '09:00',
    hora_fin: '12:00',
    estado_reserva: 'atendida',
  },
  {
    id: 'enc-seed-2',
    reserva_id: 'r2',
    codigo_reserva: 'PC-R2-1400',
    puntaje: 5,
    comentario:
      'Excelente experiencia con Matías, muy prolijo en el degradado y el ritual de barba con toallas calientes es de otro nivel.',
    respondida_en: '2026-11-19T16:45:00.000Z',
    cliente_nombre: 'Rodrigo Fuenzalida',
    cliente_email: 'rodrigo.fuenzalida@ejemplo.cl',
    cliente_telefono: '+56976543210',
    servicio_id: 's2-corte-caballero',
    servicio_nombre: 'Corte Caballero & Fade',
    estilista_id: 'e2-matias-munoz',
    estilista_nombre: 'Matías Muñoz',
    estilista_especialidad: 'Barbero Principal',
    fecha_cita: '2026-11-19',
    hora_inicio: '15:00',
    hora_fin: '15:40',
    estado_reserva: 'atendida',
  },
  {
    id: 'enc-seed-3',
    reserva_id: 'r3',
    codigo_reserva: 'PC-R3-1100',
    puntaje: 4,
    comentario:
      'El botox capilar dejó mi pelo sin frizz y con mucho movimiento. Muy puntuales con la hora agendada.',
    respondida_en: '2026-11-20T14:15:00.000Z',
    cliente_nombre: 'Javiera Castro',
    cliente_email: 'javiera.castro@ejemplo.cl',
    cliente_telefono: '+56965432198',
    servicio_id: 's6-botox-capilar',
    servicio_nombre: 'Botox Capilar Antifrizz',
    estilista_id: 'e3-camila-soto',
    estilista_nombre: 'Camila Soto',
    estilista_especialidad: 'Especialista en Tratamientos Capilares & Alisados',
    fecha_cita: '2026-11-20',
    hora_inicio: '11:00',
    hora_fin: '12:30',
    estado_reserva: 'atendida',
  },
];

function obtenerEncuestasFallbackLocal() {
  if (typeof window === 'undefined') return FALLBACK_ENCUESTAS;
  try {
    const saved = localStorage.getItem(ENCUESTAS_FALLBACK_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return FALLBACK_ENCUESTAS;
}

function guardarEncuestasFallbackLocal(lista) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ENCUESTAS_FALLBACK_KEY, JSON.stringify(lista));
  } catch (_) {}
}

function calcularStatsEncuestasLocal(items = []) {
  const total = items.length;
  const distribucion = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let suma = 0;
  let positivas = 0;
  let conComentario = 0;

  for (const item of items) {
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
}

/**
 * Emite una señal de sincronización inmediata cuando se responde o actualiza una encuesta.
 */
export function notificarActualizacionEncuestas() {
  if (typeof window === 'undefined') return;
  const ts = String(Date.now());
  try {
    localStorage.setItem(ENCUESTAS_STORAGE_KEY, ts);
  } catch (_) {}

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(ENCUESTAS_SYNC_CHANNEL);
      bc.postMessage({ type: 'ENCUESTAS_UPDATED', timestamp: ts });
      bc.close();
    }
  } catch (_) {}

  window.dispatchEvent(new CustomEvent('encuestasSatisfaccionActualizadas', { detail: ts }));
}

/**
 * Suscribe el módulo AdminEncuestasList a nuevas respuestas de encuestas en tiempo real.
 */
export function suscribirActualizacionEncuestas(onUpdate) {
  if (typeof window === 'undefined' || typeof onUpdate !== 'function') {
    return () => {};
  }

  let debounceTimer = null;
  let lastTriggerTs = 0;
  const triggerThrottledUpdate = (immediate = false) => {
    const now = Date.now();
    if (!immediate && now - lastTriggerTs < 2500) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(
      () => {
        lastTriggerTs = Date.now();
        onUpdate();
      },
      immediate ? 60 : 150
    );
  };

  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(ENCUESTAS_SYNC_CHANNEL);
      bc.onmessage = (event) => {
        if (event?.data?.type === 'ENCUESTAS_UPDATED') {
          triggerThrottledUpdate(true);
        }
      };
    }
  } catch (_) {}

  const handleStorage = (event) => {
    if (event.key === ENCUESTAS_STORAGE_KEY || event.key === ENCUESTAS_FALLBACK_KEY) {
      triggerThrottledUpdate(true);
    }
  };

  const handleCustom = () => triggerThrottledUpdate(true);
  const handleFocusOrVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      triggerThrottledUpdate(false);
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('encuestasSatisfaccionActualizadas', handleCustom);
  window.addEventListener('focus', handleFocusOrVisibility);
  document.addEventListener('visibilitychange', handleFocusOrVisibility);

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (bc) {
      try {
        bc.close();
      } catch (_) {}
    }
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('encuestasSatisfaccionActualizadas', handleCustom);
    window.removeEventListener('focus', handleFocusOrVisibility);
    document.removeEventListener('visibilitychange', handleFocusOrVisibility);
  };
}

/**
 * Listar respuestas de encuestas de satisfacción para el Panel de Administración
 */
export async function getEncuestasAdmin(headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/encuestas?_t=${Date.now()}`,
      {
        cache: 'no-store',
        headers: { ...headers },
      },
      7000
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al cargar encuestas de satisfacción');
    if (Array.isArray(json.data)) {
      guardarEncuestasFallbackLocal(json.data);
      return {
        items: json.data,
        stats: json.stats || calcularStatsEncuestasLocal(json.data),
        source: json.source || 'api',
      };
    }
    const local = obtenerEncuestasFallbackLocal();
    return {
      items: local,
      stats: calcularStatsEncuestasLocal(local),
      source: 'local',
    };
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const local = obtenerEncuestasFallbackLocal();
      return {
        items: local,
        stats: calcularStatsEncuestasLocal(local),
        source: 'local',
      };
    }
    throw err;
  }
}

/**
 * Eliminar una respuesta de encuesta desde el Panel de Administración
 */
export async function eliminarEncuestaAdmin(id, headers = {}) {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetchWithTimeout(
      `${baseUrl}/encuestas/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: { ...headers },
      },
      6000,
      0
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al eliminar la encuesta');
    const current = obtenerEncuestasFallbackLocal().filter(
      (e) => String(e.id) !== String(id) && String(e.reserva_id) !== String(id)
    );
    guardarEncuestasFallbackLocal(current);
    notificarActualizacionEncuestas();
    return json;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      const current = obtenerEncuestasFallbackLocal().filter(
        (e) => String(e.id) !== String(id) && String(e.reserva_id) !== String(id)
      );
      guardarEncuestasFallbackLocal(current);
      notificarActualizacionEncuestas();
      return { status: 'success', data: { id } };
    }
    throw err;
  }
}


const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { MOCK_SERVICIOS } = require('../database/mockData');
const supabase = require('../database/supabaseClient');
const { verificarTokenAdmin } = require('../utils/reservaToken.utils');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB máximo decodificado

/**
 * Valida los magic bytes reales del archivo decodificado para prevenir subida de archivos maliciosos
 * disfrazados con cabecera Data URI de imagen.
 */
function tieneMagicBytesValidos(buf, ext) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  if (ext === 'png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (ext === 'jpg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (ext === 'gif') {
    return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
  }
  if (ext === 'webp') {
    return (
      buf.slice(0, 4).toString('ascii') === 'RIFF' &&
      buf.slice(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

// Archivo de persistencia local para metadatos extendidos de "Nuestra Selección" y modo offline
// Se utiliza extensión .store para evitar que nodemon reinicie el servidor al persistir cambios en caliente
const META_FILE_PATH = path.join(__dirname, '../database/servicios_meta.store');
const LEGACY_META_JSON_PATH = path.join(__dirname, '../database/servicios_meta.json');
const FRONTEND_PUBLIC_SERVICIOS_DIR = path.resolve(
  __dirname,
  '../../../frontend/public/images/servicios'
);

// Configuración canónica por defecto para los 10 servicios del catálogo inicial
const CANONICAL_DEFAULTS = [
  {
    match: (n) => /balayage/i.test(n),
    orden: 1,
    duracion_min: 180,
    categoria: 'coloracion',
    etiqueta: 'Alta Coloración & Iluminación',
    icono: 'auto_awesome',
    imagen_url: '/images/servicios/servicio_1.webp',
    destacado: true,
  },
  {
    match: (n) => /corte mujer/i.test(n),
    orden: 2,
    duracion_min: 50,
    categoria: 'corte',
    etiqueta: 'Arquitectura Capilar',
    icono: 'content_cut',
    imagen_url: '/images/servicios/servicio_2.webp',
    destacado: false,
  },
  {
    match: (n) => /caballero|fade/i.test(n),
    orden: 3,
    duracion_min: 40,
    categoria: 'barberia',
    etiqueta: 'Barbería Clásica & Fade',
    icono: 'face_6',
    imagen_url: '/images/servicios/servicio_3.webp',
    destacado: false,
  },
  {
    match: (n) => /barba/i.test(n),
    orden: 4,
    duracion_min: 35,
    categoria: 'barberia',
    etiqueta: 'Ritual Tradicional & Vapor',
    icono: 'spa',
    imagen_url: '/images/servicios/servicio_4.webp',
    destacado: false,
  },
  {
    match: (n) => /coloraci[oó]n|retoque/i.test(n),
    orden: 5,
    duracion_min: 90,
    categoria: 'coloracion',
    etiqueta: 'Coloración Couture',
    icono: 'palette',
    imagen_url: '/images/servicios/servicio_5.webp',
    destacado: false,
  },
  {
    match: (n) => /botox/i.test(n),
    orden: 6,
    duracion_min: 90,
    categoria: 'tratamiento',
    etiqueta: 'Relleno Molecular Antifrizz',
    icono: 'water_drop',
    imagen_url: '/images/servicios/servicio_6.webp',
    destacado: false,
  },
  {
    match: (n) => /alisado/i.test(n),
    orden: 7,
    duracion_min: 150,
    categoria: 'tratamiento',
    etiqueta: 'Liso Progresivo Vegano',
    icono: 'eco',
    imagen_url: '/images/servicios/servicio_7.webp',
    destacado: false,
  },
  {
    match: (n) => /k18|olaplex|reparador/i.test(n),
    orden: 8,
    duracion_min: 45,
    categoria: 'tratamiento',
    etiqueta: 'Tecnología Biomimética (K18)',
    icono: 'health_and_safety',
    imagen_url: '/images/servicios/servicio_8.webp',
    destacado: false,
  },
  {
    match: (n) => /peinado|ondas/i.test(n),
    orden: 9,
    duracion_min: 60,
    categoria: 'styling',
    etiqueta: 'Estilismo Editorial & Ondas',
    icono: 'auto_awesome',
    imagen_url: '/images/servicios/servicio_9.webp',
    destacado: false,
  },
  {
    match: (n) => /manicura/i.test(n),
    orden: 10,
    duracion_min: 60,
    categoria: 'manicura',
    etiqueta: 'Cuidado & Nivelación Rusa',
    icono: 'brush',
    imagen_url: '/images/servicios/servicio_10.webp',
    destacado: false,
  },
];

const DEFAULT_CATEGORY_META = {
  coloracion: {
    etiqueta: 'Alta Coloración & Brillo',
    icono: 'palette',
    imagen_url: '/images/servicios/servicio_1.webp',
  },
  corte: {
    etiqueta: 'Arquitectura Capilar',
    icono: 'content_cut',
    imagen_url: '/images/servicios/servicio_2.webp',
  },
  barberia: {
    etiqueta: 'Barbería Clásica & Autor',
    icono: 'face_6',
    imagen_url: '/images/servicios/servicio_3.webp',
  },
  tratamiento: {
    etiqueta: 'Terapia Capilar Avanzada',
    icono: 'water_drop',
    imagen_url: '/images/servicios/servicio_6.webp',
  },
  styling: {
    etiqueta: 'Estilismo Editorial',
    icono: 'auto_awesome',
    imagen_url: '/images/servicios/servicio_9.webp',
  },
  manicura: {
    etiqueta: 'Cuidado & Nail Art',
    icono: 'brush',
    imagen_url: '/images/servicios/servicio_10.webp',
  },
};

/**
 * Carga el estado de metadatos local (o inicializa estructura vacía).
 */
function leerMetaStore() {
  try {
    const sourcePath = fs.existsSync(META_FILE_PATH)
      ? META_FILE_PATH
      : fs.existsSync(LEGACY_META_JSON_PATH)
        ? LEGACY_META_JSON_PATH
        : null;
    if (sourcePath) {
      const raw = fs.readFileSync(sourcePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        byId: parsed.byId || {},
        deletedIds: parsed.deletedIds || {},
        mockItems: Array.isArray(parsed.mockItems) ? parsed.mockItems : null,
      };
    }
  } catch (err) {
    console.warn('No se pudo leer servicios_meta.store:', err.message);
  }
  return { byId: {}, deletedIds: {}, mockItems: null };
}

/**
 * Persiste el estado de metadatos local en disco usando archivo .store para no disparar nodemon.
 */
function guardarMetaStore(store) {
  try {
    fs.writeFileSync(META_FILE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('No se pudo guardar servicios_meta.store:', err.message);
  }
}

/**
 * Obtiene la lista mutable de servicios para modo Mock/Offline, sincronizada con disco.
 */
function obtenerServiciosMock() {
  const store = leerMetaStore();
  if (Array.isArray(store.mockItems) && store.mockItems.length > 0) {
    return store.mockItems;
  }
  return MOCK_SERVICIOS.map((s) => enriquecerServicio(s, store));
}

function guardarServiciosMock(items) {
  const store = leerMetaStore();
  store.mockItems = items;
  guardarMetaStore(store);
}

/**
 * Procesa una imagen en formato Data URI (base64), la guarda en frontend/public/images/servicios/
 * y retorna la ruta pública `/images/servicios/<filename>`.
 */
function guardarImagenBase64(imagenBase64, nombreServicio = 'servicio') {
  if (!imagenBase64 || typeof imagenBase64 !== 'string') return null;

  const match = imagenBase64.match(/^data:image\/(webp|png|jpeg|jpg|gif);base64,(.+)$/i);
  if (!match) return null;

  const rawExt = match[1].toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const base64Data = match[2];
  const decodedBuffer = Buffer.from(base64Data, 'base64');

  if (decodedBuffer.length === 0 || decodedBuffer.length > MAX_IMAGE_BYTES) {
    return null;
  }

  if (!tieneMagicBytesValidos(decodedBuffer, ext)) {
    return null;
  }

  const slug = String(nombreServicio || 'servicio')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28) || 'servicio';

  const filename = `${slug}_${Date.now()}.${ext}`;

  try {
    if (!fs.existsSync(FRONTEND_PUBLIC_SERVICIOS_DIR)) {
      fs.mkdirSync(FRONTEND_PUBLIC_SERVICIOS_DIR, { recursive: true });
    }
    const targetPath = path.join(FRONTEND_PUBLIC_SERVICIOS_DIR, filename);
    fs.writeFileSync(targetPath, decodedBuffer);
    return `/images/servicios/${filename}`;
  } catch (err) {
    console.warn('Fallback a Data URI directa para imagen de servicio:', err.message);
    return imagenBase64;
  }
}

/**
 * Enriquecer una fila de servicio (proveniente de Supabase o Mock) con los campos de "Nuestra Selección"
 */
function enriquecerServicio(row, store = null) {
  if (!row) return null;
  const metaStore = store || leerMetaStore();
  const idKey = String(row.id);
  const savedOverride = metaStore.byId[idKey] || {};

  const nombre =
    savedOverride.nombre !== undefined && String(savedOverride.nombre).trim()
      ? String(savedOverride.nombre).trim()
      : row.nombre;

  const descripcion =
    savedOverride.descripcion !== undefined
      ? String(savedOverride.descripcion)
      : row.descripcion || '';

  const precio =
    savedOverride.precio !== undefined && savedOverride.precio !== null
      ? Number(savedOverride.precio)
      : Number(row.precio ?? 0);

  const canonical = CANONICAL_DEFAULTS.find((c) => c.match(nombre || row.nombre || ''));

  const categoria = (
    savedOverride.categoria ||
    row.categoria ||
    (canonical ? canonical.categoria : 'coloracion')
  ).toLowerCase();

  const catDefaults =
    DEFAULT_CATEGORY_META[categoria] ||
    DEFAULT_CATEGORY_META.coloracion;

  const en_seleccion =
    savedOverride.en_seleccion !== undefined
      ? Boolean(savedOverride.en_seleccion)
      : row.en_seleccion !== undefined && row.en_seleccion !== null
      ? Boolean(row.en_seleccion)
      : true;

  const orden =
    savedOverride.orden !== undefined && savedOverride.orden !== null
      ? Number(savedOverride.orden)
      : row.orden !== undefined && row.orden !== null && Number(row.orden) > 0
      ? Number(row.orden)
      : canonical
      ? canonical.orden
      : 99;

  const imagen_url =
    savedOverride.imagen_url ||
    row.imagen_url ||
    (canonical ? canonical.imagen_url : catDefaults.imagen_url);

  const etiqueta =
    savedOverride.etiqueta ||
    row.etiqueta ||
    (canonical ? canonical.etiqueta : catDefaults.etiqueta);

  const icono =
    savedOverride.icono ||
    row.icono ||
    (canonical ? canonical.icono : catDefaults.icono);

  const destacado =
    savedOverride.destacado !== undefined
      ? Boolean(savedOverride.destacado)
      : row.destacado !== undefined && row.destacado !== null
      ? Boolean(row.destacado)
      : canonical
      ? Boolean(canonical.destacado)
      : false;

  const activo =
    savedOverride.activo !== undefined
      ? Boolean(savedOverride.activo)
      : row.activo !== undefined && row.activo !== null
      ? Boolean(row.activo)
      : true;

  const duracion_min =
    savedOverride.duracion_min !== undefined && savedOverride.duracion_min !== null && Number(savedOverride.duracion_min) > 0
      ? Number(savedOverride.duracion_min)
      : canonical && canonical.duracion_min
      ? Number(canonical.duracion_min)
      : row.duracion_min !== undefined && row.duracion_min !== null && Number(row.duracion_min) > 0
      ? Number(row.duracion_min)
      : 45;

  return {
    ...row,
    nombre,
    descripcion,
    precio,
    categoria,
    duracion_min,
    activo,
    en_seleccion,
    orden,
    imagen_url,
    etiqueta,
    icono,
    destacado,
  };
}

/**
 * Ordena los servicios por `orden` ascendente y luego por nombre.
 */
function ordenarServicios(lista = []) {
  return [...lista].sort((a, b) => {
    const ordA = Number(a.orden ?? 99);
    const ordB = Number(b.orden ?? 99);
    if (ordA !== ordB) return ordA - ordB;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
  });
}

/**
 * Aplica cabeceras HTTP para impedir caché obsoleto en navegador/CDN y reflejar cambios de inmediato.
 */
function setNoCacheHeaders(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

const STATIC_MOCK_IDS = new Set(MOCK_SERVICIOS.map((s) => String(s.id)));

/**
 * Obtener catálogo completo desde Supabase (enriquecido y fusionado con servicios locales nuevos)
 * o Mock de respaldo.
 */
async function obtenerCatalogoCompleto() {
  const store = leerMetaStore();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('servicios').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        const supabaseIds = new Set(data.map((r) => String(r.id)));
        const visibles = data
          .filter((row) => !store.deletedIds[String(row.id)])
          .map((row) => enriquecerServicio(row, store));

        // Fusionar servicios creados en Admin que se hayan persistido localmente
        // cuando la tabla remota de Supabase rechazó el INSERT por diferencias de esquema o RLS
        if (Array.isArray(store.mockItems)) {
          for (const localItem of store.mockItems) {
            const localId = String(localItem.id);
            if (
              !supabaseIds.has(localId) &&
              !STATIC_MOCK_IDS.has(localId) &&
              !store.deletedIds[localId]
            ) {
              visibles.push(enriquecerServicio(localItem, store));
            }
          }
        }

        return { items: ordenarServicios(visibles), source: 'supabase' };
      }
    } catch (err) {
      console.warn('Fallback a catálogo local en obtenerCatalogoCompleto:', err.message);
    }
  }

  const mockItems = obtenerServiciosMock()
    .filter((row) => !store.deletedIds[String(row.id)])
    .map((row) => enriquecerServicio(row, store));

  return { items: ordenarServicios(mockItems), source: 'mock' };
}

/**
 * GET /api/v1/servicios/seleccion
 * Endpoint público optimizado para alimentar la sección "Nuestra Selección" en la landing page.
 * Devuelve únicamente servicios activos y marcados con `en_seleccion = true`, ordenados por `orden ASC`.
 */
const getServiciosSeleccion = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { categoria } = req.query;
    const { items, source } = await obtenerCatalogoCompleto();

    let seleccion = items.filter((s) => s.activo === true && s.en_seleccion === true);

    if (categoria && categoria !== 'all') {
      const catLower = String(categoria).toLowerCase();
      seleccion = seleccion.filter((s) => String(s.categoria || '').toLowerCase() === catLower);
    }

    return res.status(200).json({
      status: 'success',
      source,
      count: seleccion.length,
      updated_at: new Date().toISOString(),
      data: seleccion,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/servicios
 * Lista servicios del catálogo.
 * Query params:
 *   - categoria: filtra por categoría
 *   - incluir_inactivos: 'true' para incluir servicios pausados/inactivos (usado en Admin)
 *   - seleccion: 'true' | 'false' para filtrar por pertenencia a "Nuestra Selección"
 */
const getServicios = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { categoria, incluir_inactivos, seleccion } = req.query;
    const { items, source } = await obtenerCatalogoCompleto();

    let resultado = items;

    // Solo permitir ver servicios inactivos si la petición incluye un token administrativo válido
    let puedeVerInactivos = false;
    if (incluir_inactivos === 'true') {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (verificarTokenAdmin(token)) {
          puedeVerInactivos = true;
        } else if (supabase) {
          const { data, error } = await supabase.auth.getUser(token);
          if (
            !error &&
            data?.user &&
            (data.user.email === process.env.ADMIN_EMAIL || data.user.user_metadata?.is_admin === true)
          ) {
            puedeVerInactivos = true;
          }
        }
      }
    }

    if (!puedeVerInactivos) {
      resultado = resultado.filter((s) => s.activo === true);
    }

    if (seleccion === 'true') {
      resultado = resultado.filter((s) => s.en_seleccion === true);
    } else if (seleccion === 'false') {
      resultado = resultado.filter((s) => s.en_seleccion === false);
    }

    if (categoria) {
      const catLower = String(categoria).toLowerCase();
      resultado = resultado.filter((s) => String(s.categoria || '').toLowerCase() === catLower);
    }

    return res.status(200).json({
      status: 'success',
      source,
      count: resultado.length,
      data: resultado,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/servicios/:id
 * Obtener detalle de un servicio por ID.
 */
const getServicioById = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const { items, source } = await obtenerCatalogoCompleto();

    const servicio = items.find((s) => String(s.id) === String(id));
    if (!servicio) {
      return res.status(404).json({
        status: 'error',
        message: `Servicio con ID '${id}' no encontrado.`,
      });
    }

    return res.status(200).json({
      status: 'success',
      source,
      data: servicio,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/servicios
 * Crear un nuevo servicio en el catálogo y configurar su aparición en "Nuestra Selección".
 */
const crearServicio = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { items } = await obtenerCatalogoCompleto();
    const store = leerMetaStore();

    const nombre = req.body.nombre.trim();
    const descripcion = req.body.descripcion ? req.body.descripcion.trim() : '';
    const duracion_min = Number(req.body.duracion_min);
    const precio = Number(req.body.precio);
    const categoria = req.body.categoria.trim().toLowerCase();
    const activo = req.body.activo !== undefined ? Boolean(req.body.activo) : true;
    const en_seleccion = req.body.en_seleccion !== undefined ? Boolean(req.body.en_seleccion) : true;
    const destacado = req.body.destacado !== undefined ? Boolean(req.body.destacado) : false;

    const maxOrden = items.reduce((max, s) => Math.max(max, Number(s.orden || 0)), 0);
    const orden =
      req.body.orden !== undefined && req.body.orden !== null && req.body.orden !== ''
        ? Number(req.body.orden)
        : maxOrden + 1;

    const catDefaults = DEFAULT_CATEGORY_META[categoria] || DEFAULT_CATEGORY_META.coloracion;
    const etiqueta =
      req.body.etiqueta && req.body.etiqueta.trim()
        ? req.body.etiqueta.trim()
        : catDefaults.etiqueta;
    const icono =
      req.body.icono && req.body.icono.trim()
        ? req.body.icono.trim()
        : catDefaults.icono;

    let imagen_url = req.body.imagen_url ? req.body.imagen_url.trim() : '';
    if (req.body.imagen_base64) {
      const savedPath = guardarImagenBase64(req.body.imagen_base64, nombre);
      if (savedPath) imagen_url = savedPath;
    }
    if (!imagen_url) {
      imagen_url = catDefaults.imagen_url;
    }

    let createdRow = null;
    let source = 'mock';

    if (supabase) {
      const candidatePayloads = [
        {
          nombre,
          descripcion,
          duracion_min,
          precio,
          categoria,
          activo,
          en_seleccion,
          orden,
          imagen_url,
          etiqueta,
          icono,
          destacado,
        },
        {
          nombre,
          descripcion,
          duracion_min,
          precio,
          categoria,
          activo,
        },
        {
          nombre,
          descripcion,
          duracion_min,
          precio,
          activo,
        },
        {
          nombre,
          duracion_min,
          precio,
        },
      ];

      for (const candidate of candidatePayloads) {
        try {
          const { data, error } = await supabase
            .from('servicios')
            .insert([candidate])
            .select('*')
            .single();
          if (!error && data) {
            createdRow = data;
            source = 'supabase';
            break;
          }
        } catch (_) {}
      }
    }

    if (!createdRow) {
      const slugId = `s-${Date.now().toString(36)}-${uuidv4().slice(0, 4)}`;
      createdRow = {
        id: slugId,
        nombre,
        descripcion,
        duracion_min,
        precio,
        categoria,
        activo,
        en_seleccion,
        orden,
        imagen_url,
        etiqueta,
        icono,
        destacado,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const mockList = obtenerServiciosMock();
      mockList.push(createdRow);
      store.mockItems = mockList;
    }

    // Persistir todos los campos en el store para garantizar consistencia total
    const idKey = String(createdRow.id);
    store.byId[idKey] = {
      nombre,
      descripcion,
      precio,
      categoria,
      duracion_min,
      activo,
      en_seleccion,
      orden,
      imagen_url,
      etiqueta,
      icono,
      destacado,
    };
    delete store.deletedIds[idKey];
    guardarMetaStore(store);

    const servicioFinal = enriquecerServicio(createdRow, store);

    return res.status(201).json({
      status: 'success',
      source,
      message: 'Servicio creado exitosamente.',
      data: servicioFinal,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT / PATCH /api/v1/servicios/:id
 * Actualizar campos de un servicio existente (precio, información, imagen, orden, visibilidad).
 */
const actualizarServicio = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const { items } = await obtenerCatalogoCompleto();
    const actual = items.find((s) => String(s.id) === String(id));

    if (!actual) {
      return res.status(404).json({
        status: 'error',
        message: `Servicio con ID '${id}' no encontrado.`,
      });
    }

    const store = leerMetaStore();
    const idKey = String(actual.id);

    const nombre = req.body.nombre !== undefined ? req.body.nombre.trim() : actual.nombre;
    const descripcion =
      req.body.descripcion !== undefined
        ? String(req.body.descripcion || '').trim()
        : actual.descripcion;
    const duracion_min =
      req.body.duracion_min !== undefined ? Number(req.body.duracion_min) : actual.duracion_min;
    const precio = req.body.precio !== undefined ? Number(req.body.precio) : actual.precio;
    const categoria =
      req.body.categoria !== undefined
        ? req.body.categoria.trim().toLowerCase()
        : actual.categoria;
    const activo = req.body.activo !== undefined ? Boolean(req.body.activo) : actual.activo;
    const en_seleccion =
      req.body.en_seleccion !== undefined ? Boolean(req.body.en_seleccion) : actual.en_seleccion;
    const orden =
      req.body.orden !== undefined && req.body.orden !== null && req.body.orden !== ''
        ? Number(req.body.orden)
        : actual.orden;
    const etiqueta =
      req.body.etiqueta !== undefined ? String(req.body.etiqueta || '').trim() : actual.etiqueta;
    const icono =
      req.body.icono !== undefined ? String(req.body.icono || '').trim() : actual.icono;
    const destacado =
      req.body.destacado !== undefined ? Boolean(req.body.destacado) : actual.destacado;

    let imagen_url =
      req.body.imagen_url !== undefined ? String(req.body.imagen_url || '').trim() : actual.imagen_url;

    if (req.body.imagen_base64) {
      const savedPath = guardarImagenBase64(req.body.imagen_base64, nombre);
      if (savedPath) imagen_url = savedPath;
    }

    let updatedRow = null;
    let source = 'mock';

    if (supabase && !String(actual.id).startsWith('s-')) {
      const candidateUpdates = [
        {
          nombre,
          descripcion,
          duracion_min,
          precio,
          categoria,
          activo,
          en_seleccion,
          orden,
          imagen_url,
          etiqueta,
          icono,
          destacado,
        },
        {
          nombre,
          descripcion,
          duracion_min,
          precio,
          categoria,
          activo,
        },
        {
          nombre,
          descripcion,
          duracion_min,
          precio,
          activo,
        },
        {
          nombre,
          duracion_min,
          precio,
        },
      ];

      for (const candidate of candidateUpdates) {
        try {
          const { data, error } = await supabase
            .from('servicios')
            .update(candidate)
            .eq('id', actual.id)
            .select('*')
            .maybeSingle();
          if (!error && data) {
            updatedRow = data;
            source = 'supabase';
            break;
          }
        } catch (_) {}
      }
    }

    // Actualizar metadatos persistentes completos
    store.byId[idKey] = {
      ...(store.byId[idKey] || {}),
      nombre,
      descripcion,
      precio,
      categoria,
      duracion_min,
      activo,
      en_seleccion,
      orden,
      imagen_url,
      etiqueta,
      icono,
      destacado,
    };

    // Actualizar también lista mock de respaldo si aplica
    const mockList = obtenerServiciosMock();
    const mockIdx = mockList.findIndex((s) => String(s.id) === idKey);
    const mergedObj = {
      ...actual,
      ...(updatedRow || {}),
      nombre,
      descripcion,
      duracion_min,
      precio,
      categoria,
      activo,
      en_seleccion,
      orden,
      imagen_url,
      etiqueta,
      icono,
      destacado,
      updated_at: new Date().toISOString(),
    };

    if (mockIdx !== -1) {
      mockList[mockIdx] = mergedObj;
      store.mockItems = mockList;
    }
    guardarMetaStore(store);

    const servicioFinal = enriquecerServicio(mergedObj, store);

    return res.status(200).json({
      status: 'success',
      source,
      message: 'Servicio actualizado correctamente.',
      data: servicioFinal,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/servicios/:id/visibilidad
 * Endpoint rápido para conmutar la visibilidad en "Nuestra Selección" (`en_seleccion`) y/o estado `activo`.
 */
const toggleVisibilidadServicio = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const { items } = await obtenerCatalogoCompleto();
    const actual = items.find((s) => String(s.id) === String(id));

    if (!actual) {
      return res.status(404).json({
        status: 'error',
        message: `Servicio con ID '${id}' no encontrado.`,
      });
    }

    const nuevoEnSeleccion =
      req.body.en_seleccion !== undefined ? Boolean(req.body.en_seleccion) : !actual.en_seleccion;
    const nuevoActivo =
      req.body.activo !== undefined ? Boolean(req.body.activo) : actual.activo;

    req.body = {
      en_seleccion: nuevoEnSeleccion,
      activo: nuevoActivo,
    };

    return actualizarServicio(req, res, next);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/servicios/:id
 * Elimina un servicio del catálogo. Si existen reservas históricas asociadas en BD,
 * aplica baja segura para no corromper la integridad referencial.
 */
const eliminarServicio = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const { items } = await obtenerCatalogoCompleto();
    const actual = items.find((s) => String(s.id) === String(id));

    if (!actual) {
      return res.status(404).json({
        status: 'error',
        message: `Servicio con ID '${id}' no encontrado.`,
      });
    }

    const store = leerMetaStore();
    const idKey = String(actual.id);
    let source = 'mock';

    if (supabase && !String(actual.id).startsWith('s-')) {
      // Limpiar relaciones con estilistas primero
      try {
        await supabase.from('estilista_servicios').delete().eq('servicio_id', actual.id);
      } catch (_) {}
      try {
        await supabase.from('estilista_servicio').delete().eq('servicio_id', actual.id);
      } catch (_) {}

      const { error } = await supabase.from('servicios').delete().eq('id', actual.id);

      if (error) {
        // Si tiene reservas asociadas (FK constraint), desactivar en BD y ocultar del catálogo
        try {
          await supabase
            .from('servicios')
            .update({ activo: false })
            .eq('id', actual.id);
        } catch (_) {}
      }
      source = 'supabase';
    }

    store.deletedIds[idKey] = true;
    delete store.byId[idKey];
    const mockList = obtenerServiciosMock().filter((s) => String(s.id) !== idKey);
    store.mockItems = mockList;
    guardarMetaStore(store);

    return res.status(200).json({
      status: 'success',
      source,
      message: `Servicio '${actual.nombre}' eliminado del catálogo correctamente.`,
      data: { id: actual.id },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/servicios/upload-imagen
 * Endpoint dedicado para subir una imagen de servicio y obtener su URL pública.
 */
const subirImagenServicio = async (req, res, next) => {
  try {
    const { imagen_base64, nombre } = req.body || {};
    if (!imagen_base64) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo imagen_base64 con una imagen válida.',
      });
    }

    const imagenUrl = guardarImagenBase64(imagen_base64, nombre || 'servicio');
    if (!imagenUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Formato de imagen no soportado. Usa WebP, PNG, JPG o GIF.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Imagen procesada correctamente.',
      data: { imagen_url: imagenUrl },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  obtenerCatalogoCompleto,
  getServiciosSeleccion,
  getServicios,
  getServicioById,
  crearServicio,
  actualizarServicio,
  toggleVisibilidadServicio,
  eliminarServicio,
  subirImagenServicio,
};

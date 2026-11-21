const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { MOCK_ESTILISTAS, MOCK_SERVICIOS } = require('../database/mockData');
const supabase = require('../database/supabaseClient');
const { verificarTokenAdmin } = require('../utils/reservaToken.utils');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB máximo decodificado

const META_FILE_PATH = path.join(__dirname, '../database/estilistas_meta.store');
const FRONTEND_PUBLIC_EQUIPO_DIR = path.resolve(
  __dirname,
  '../../../frontend/public/images/maestros_tijera'
);

const DEFAULT_FALLBACK_FOTO = '/images/maestros_tijera/carolina_valenzuela.webp';

// Configuración canónica para los 5 estilistas iniciales
const CANONICAL_STYLIST_DEFAULTS = [
  {
    match: (full) => full.includes('carolina'),
    orden: 1,
    foto_url: '/images/maestros_tijera/carolina_valenzuela.webp',
    especialidad: 'Directora Técnica & Colorista Especialista',
    nivel: 'master',
  },
  {
    match: (full) => full.includes('matias'),
    orden: 2,
    foto_url: '/images/maestros_tijera/matias_munoz.webp',
    especialidad: 'Barbero Principal',
    nivel: 'artisan',
  },
  {
    match: (full) => full.includes('camila'),
    orden: 3,
    foto_url: '/images/maestros_tijera/camila_soto.webp',
    especialidad: 'Especialista en Tratamientos Capilares & Alisados',
    nivel: 'senior',
  },
  {
    match: (full) => full.includes('gonzalo'),
    orden: 4,
    foto_url: '/images/maestros_tijera/gonzalo_riquelme.webp',
    especialidad: 'Estilista Senior & Peinador',
    nivel: 'master',
  },
  {
    match: (full) => full.includes('valentina'),
    orden: 5,
    foto_url: '/images/maestros_tijera/valentina_morales.webp',
    especialidad: 'Manicurista & Cuidado Integral',
    nivel: 'senior',
  },
];

/**
 * Normaliza texto removiendo acentos y convirtiendo a minúsculas.
 */
const normalizarTexto = (txt = '') =>
  String(txt)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/**
 * Valida los magic bytes reales del archivo decodificado para prevenir subida de archivos maliciosos.
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

function setNoCacheHeaders(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function leerMetaStore() {
  try {
    if (fs.existsSync(META_FILE_PATH)) {
      const raw = fs.readFileSync(META_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        byId: parsed.byId || {},
        deletedIds: parsed.deletedIds || {},
        mockItems: Array.isArray(parsed.mockItems) ? parsed.mockItems : null,
      };
    }
  } catch (err) {
    console.warn('No se pudo leer estilistas_meta.store:', err.message);
  }
  return { byId: {}, deletedIds: {}, mockItems: null };
}

function guardarMetaStore(store) {
  try {
    fs.writeFileSync(META_FILE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('No se pudo guardar estilistas_meta.store:', err.message);
  }
}

/**
 * Procesa una imagen en formato Data URI (base64), la guarda en frontend/public/images/maestros_tijera/
 * y retorna la ruta pública `/images/maestros_tijera/<filename>`.
 */
function guardarImagenBase64(imagenBase64, nombreEstilista = 'estilista') {
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

  const slug =
    String(nombreEstilista || 'estilista')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 28) || 'estilista';

  const filename = `${slug}_${Date.now()}.${ext}`;

  try {
    if (!fs.existsSync(FRONTEND_PUBLIC_EQUIPO_DIR)) {
      fs.mkdirSync(FRONTEND_PUBLIC_EQUIPO_DIR, { recursive: true });
    }
    const targetPath = path.join(FRONTEND_PUBLIC_EQUIPO_DIR, filename);
    fs.writeFileSync(targetPath, decodedBuffer);
    return `/images/maestros_tijera/${filename}`;
  } catch (err) {
    console.warn('Fallback a Data URI directa para imagen de estilista:', err.message);
    return imagenBase64;
  }
}

function enriquecerEstilista(row, store = null) {
  if (!row) return null;
  const metaStore = store || leerMetaStore();
  const idKey = String(row.id);
  const savedOverride = metaStore.byId[idKey] || {};

  const nombre =
    savedOverride.nombre !== undefined && String(savedOverride.nombre).trim()
      ? String(savedOverride.nombre).trim()
      : String(row.nombre || '').trim();

  const apellido =
    savedOverride.apellido !== undefined
      ? String(savedOverride.apellido || '').trim()
      : String(row.apellido || '').trim();

  const fullNorm = normalizarTexto(`${nombre} ${apellido}`);
  const canonical = CANONICAL_STYLIST_DEFAULTS.find((c) => c.match(fullNorm));

  const especialidad =
    savedOverride.especialidad !== undefined
      ? String(savedOverride.especialidad || '').trim()
      : row.especialidad || (canonical ? canonical.especialidad : 'Estilista Profesional');

  const bio =
    savedOverride.bio !== undefined
      ? String(savedOverride.bio || '').trim()
      : String(row.bio || row.descripcion || '').trim();

  const nivel = (
    savedOverride.nivel ||
    row.nivel ||
    (canonical ? canonical.nivel : 'senior')
  ).toLowerCase();

  const activo =
    savedOverride.activo !== undefined
      ? Boolean(savedOverride.activo)
      : row.activo !== undefined && row.activo !== null
      ? Boolean(row.activo)
      : true;

  const orden =
    savedOverride.orden !== undefined && savedOverride.orden !== null
      ? Number(savedOverride.orden)
      : row.orden !== undefined && row.orden !== null && Number(row.orden) > 0
      ? Number(row.orden)
      : canonical
      ? canonical.orden
      : 99;

  const fotoFromRow =
    row.foto_url && !String(row.foto_url).includes('googleusercontent') ? row.foto_url : '';

  const foto_url =
    savedOverride.foto_url ||
    fotoFromRow ||
    (canonical ? canonical.foto_url : DEFAULT_FALLBACK_FOTO);

  const relIds = Array.isArray(row.estilista_servicio)
    ? row.estilista_servicio.map((r) => r.servicio_id)
    : [];

  const servicios_ids = Array.isArray(savedOverride.servicios_ids)
    ? savedOverride.servicios_ids
    : relIds.length > 0
    ? relIds
    : Array.isArray(row.servicios_ids)
    ? row.servicios_ids
    : [];

  const { estilista_servicio, ...rest } = row;

  return {
    ...rest,
    id: row.id,
    nombre,
    apellido,
    especialidad,
    bio,
    nivel,
    activo,
    orden,
    foto_url,
    servicios_ids,
  };
}

function ordenarEstilistas(lista = []) {
  return [...lista].sort((a, b) => {
    const ordA = Number(a.orden ?? 99);
    const ordB = Number(b.orden ?? 99);
    if (ordA !== ordB) return ordA - ordB;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
  });
}

function obtenerEstilistasMock(store = null) {
  const metaStore = store || leerMetaStore();
  if (Array.isArray(metaStore.mockItems) && metaStore.mockItems.length > 0) {
    return metaStore.mockItems;
  }
  return MOCK_ESTILISTAS.map((e) => enriquecerEstilista(e, metaStore));
}

const STATIC_MOCK_IDS = new Set(MOCK_ESTILISTAS.map((e) => String(e.id)));

/**
 * Obtener equipo completo desde Supabase (enriquecido y fusionado con registros locales)
 * o Mock de respaldo.
 */
async function obtenerEquipoCompleto() {
  const store = leerMetaStore();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('estilistas')
        .select('*, estilista_servicio(servicio_id)');

      if (!error && Array.isArray(data) && data.length > 0) {
        const supabaseIds = new Set(data.map((r) => String(r.id)));
        const visibles = data
          .filter((row) => !store.deletedIds[String(row.id)])
          .map((row) => enriquecerEstilista(row, store));

        if (Array.isArray(store.mockItems)) {
          for (const localItem of store.mockItems) {
            const localId = String(localItem.id);
            if (
              !supabaseIds.has(localId) &&
              !STATIC_MOCK_IDS.has(localId) &&
              !store.deletedIds[localId]
            ) {
              visibles.push(enriquecerEstilista(localItem, store));
            }
          }
        }

        return { items: ordenarEstilistas(visibles), source: 'supabase' };
      }
    } catch (err) {
      console.warn('Fallback a equipo local en obtenerEquipoCompleto:', err.message);
    }
  }

  const mockItems = obtenerEstilistasMock(store)
    .filter((row) => !store.deletedIds[String(row.id)])
    .map((row) => enriquecerEstilista(row, store));

  return { items: ordenarEstilistas(mockItems), source: 'mock' };
}

/**
 * Verifica si un estilista está asignado a un servicio específico.
 * - Si el estilista tiene `servicios_ids` explícitos, se usa esa lista.
 * - Para los 5 estilistas canónicos sin `servicios_ids`, se respeta la matriz oficial.
 * - Para miembros nuevos sin `servicios_ids` restringidos, pueden atender todos los servicios.
 */
const estilistaCorrespondeAServicio = (estilista, servicio) => {
  if (!estilista || !servicio) return false;

  if (Array.isArray(estilista.servicios_ids) && estilista.servicios_ids.length > 0) {
    return estilista.servicios_ids.some((id) => String(id) === String(servicio.id));
  }

  const sName = normalizarTexto(servicio.nombre);
  const eName = normalizarTexto(`${estilista.nombre || ''} ${estilista.apellido || ''}`);

  const esCanonico =
    eName.includes('carolina') ||
    eName.includes('matias') ||
    eName.includes('camila') ||
    eName.includes('gonzalo') ||
    eName.includes('valentina');

  if (!esCanonico) {
    return true;
  }

  if (sName.includes('balayage') || sName.includes('coloracion') || sName.includes('retoque')) {
    return eName.includes('carolina');
  }
  if (sName.includes('caballero') || sName.includes('fade') || sName.includes('barba')) {
    return eName.includes('matias');
  }
  if (
    sName.includes('botox') ||
    sName.includes('alisado') ||
    sName.includes('masaje reparador') ||
    sName.includes('k18') ||
    sName.includes('olaplex')
  ) {
    return eName.includes('camila');
  }
  if (sName.includes('corte mujer') || sName.includes('peinado') || sName.includes('ondas')) {
    return eName.includes('gonzalo');
  }
  if (sName.includes('manicura') || sName.includes('esmaltado')) {
    return eName.includes('valentina');
  }

  const sCat = normalizarTexto(servicio.categoria);
  if (sCat === 'coloracion') return eName.includes('carolina');
  if (sCat === 'barberia') return eName.includes('matias');
  if (sCat === 'tratamiento') return eName.includes('camila');
  if (sCat === 'corte' || sCat === 'styling') return eName.includes('gonzalo');
  if (sCat === 'manicura') return eName.includes('valentina');

  return false;
};

/**
 * Obtener la lista de estilistas
 * GET /api/v1/estilistas
 * Query params:
 *   - nivel: filtrar por nivel
 *   - servicio_id: filtrar por servicio asignado
 *   - incluir_inactivos: 'true' (solo si el token admin es válido)
 */
const getEstilistas = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { nivel, servicio_id, incluir_inactivos } = req.query;
    const { items, source } = await obtenerEquipoCompleto();

    let resultado = items;

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
            (data.user.email === process.env.ADMIN_EMAIL ||
              data.user.user_metadata?.is_admin === true)
          ) {
            puedeVerInactivos = true;
          }
        }
      }
    }

    if (!puedeVerInactivos) {
      resultado = resultado.filter((e) => e.activo === true);
    }

    if (nivel) {
      resultado = resultado.filter(
        (e) => String(e.nivel || '').toLowerCase() === String(nivel).toLowerCase()
      );
    }

    if (servicio_id) {
      let targetSvc = MOCK_SERVICIOS.find((s) => String(s.id) === String(servicio_id));
      if (!targetSvc && supabase) {
        try {
          const { data: svcData } = await supabase
            .from('servicios')
            .select('*')
            .eq('id', isNaN(servicio_id) ? servicio_id : Number(servicio_id))
            .maybeSingle();
          if (svcData) targetSvc = svcData;
        } catch (_) {}
      }
      resultado = resultado.filter((e) =>
        targetSvc
          ? estilistaCorrespondeAServicio(e, targetSvc)
          : Array.isArray(e.servicios_ids) &&
            e.servicios_ids.some((id) => String(id) === String(servicio_id))
      );
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
 * Obtener un estilista por ID
 * GET /api/v1/estilistas/:id
 */
const getEstilistaById = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const { items, source } = await obtenerEquipoCompleto();

    const estilista = items.find((e) => String(e.id) === String(id));
    if (!estilista) {
      return res.status(404).json({
        status: 'error',
        message: `Estilista con ID '${id}' no encontrado`,
      });
    }

    return res.status(200).json({
      status: 'success',
      source,
      data: estilista,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener los servicios habilitados para un estilista específico
 * GET /api/v1/estilistas/:id/servicios
 */
const getServiciosPorEstilista = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const { items } = await obtenerEquipoCompleto();
    const estilista = items.find((e) => String(e.id) === String(id) || String(e.id) === `e${id}`);

    if (!estilista) {
      return res.status(404).json({
        status: 'error',
        message: `Estilista con ID '${id}' no encontrado`,
      });
    }

    if (supabase) {
      const numId = isNaN(id) ? null : Number(id);
      const queryId = numId !== null ? numId : id;
      const { data, error } = await supabase
        .from('estilista_servicio')
        .select('servicios(*)')
        .eq('estilista_id', queryId);

      if (!error && data && data.length > 0) {
        const servicios = data.map((item) => item.servicios).filter(Boolean);
        return res.status(200).json({
          status: 'success',
          count: servicios.length,
          data: servicios,
        });
      }
    }

    const servicios = MOCK_SERVICIOS.filter((s) => estilistaCorrespondeAServicio(estilista, s));

    return res.status(200).json({
      status: 'success',
      source: 'mock',
      count: servicios.length,
      data: servicios,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/estilistas/upload-imagen
 * Sube una imagen base64 para un miembro del equipo y retorna su ruta pública.
 */
const subirImagenEstilista = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { imagen_base64, nombre } = req.body || {};

    if (!imagen_base64 || typeof imagen_base64 !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere una imagen codificada en base64 válida.',
      });
    }

    const savedUrl = guardarImagenBase64(imagen_base64, nombre || 'estilista');
    if (!savedUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Formato o tamaño de imagen inválido (máx. 5 MB; WebP, PNG, JPEG o GIF).',
      });
    }

    return res.status(201).json({
      status: 'success',
      data: { foto_url: savedUrl },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/estilistas
 * Crear un nuevo miembro del equipo (solo Admin).
 */
const crearEstilista = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { items } = await obtenerEquipoCompleto();
    const store = leerMetaStore();

    const nombre = req.body.nombre.trim();
    const apellido = req.body.apellido ? String(req.body.apellido).trim() : '';
    const especialidad = req.body.especialidad
      ? String(req.body.especialidad).trim()
      : 'Estilista Profesional';
    const bioRaw = req.body.bio !== undefined ? req.body.bio : req.body.descripcion;
    const bio = bioRaw ? String(bioRaw).trim() : '';
    const nivel = req.body.nivel ? String(req.body.nivel).trim().toLowerCase() : 'senior';
    const activo = req.body.activo !== undefined ? Boolean(req.body.activo) : true;
    const servicios_ids = Array.isArray(req.body.servicios_ids) ? req.body.servicios_ids : [];

    const maxOrden = items.reduce((max, e) => Math.max(max, Number(e.orden || 0)), 0);
    const orden =
      req.body.orden !== undefined && req.body.orden !== null && req.body.orden !== ''
        ? Number(req.body.orden)
        : maxOrden + 1;

    let foto_url = req.body.foto_url ? String(req.body.foto_url).trim() : '';
    if (req.body.imagen_base64) {
      const savedPath = guardarImagenBase64(req.body.imagen_base64, `${nombre}_${apellido}`);
      if (savedPath) foto_url = savedPath;
    }
    if (!foto_url) {
      foto_url = DEFAULT_FALLBACK_FOTO;
    }

    let createdRow = null;
    let source = 'mock';

    if (supabase) {
      const candidatePayloads = [
        { nombre, apellido, especialidad, bio, foto_url, nivel, activo },
        { nombre, apellido, especialidad, bio, nivel, activo },
        { nombre, apellido, especialidad, activo },
        { nombre, apellido },
      ];

      for (const candidate of candidatePayloads) {
        try {
          const { data, error } = await supabase
            .from('estilistas')
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
      const slugBase = normalizarTexto(`${nombre}-${apellido}`)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24);
      const slugId = `e-${slugBase || 'staff'}-${Date.now().toString(36)}-${uuidv4().slice(0, 4)}`;
      createdRow = {
        id: slugId,
        nombre,
        apellido,
        especialidad,
        bio,
        foto_url,
        nivel,
        activo,
        orden,
        servicios_ids,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const mockList = obtenerEstilistasMock(store);
      mockList.push(createdRow);
      store.mockItems = mockList;
    }

    const idKey = String(createdRow.id);
    store.byId[idKey] = {
      nombre,
      apellido,
      especialidad,
      bio,
      foto_url,
      nivel,
      activo,
      orden,
      servicios_ids,
    };
    delete store.deletedIds[idKey];
    guardarMetaStore(store);

    const estilistaFinal = enriquecerEstilista(createdRow, store);

    return res.status(201).json({
      status: 'success',
      source,
      message: 'Miembro del equipo creado exitosamente.',
      data: estilistaFinal,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT / PATCH /api/v1/estilistas/:id
 * Actualizar información, imagen, orden o visibilidad de un estilista (solo Admin).
 */
const actualizarEstilista = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const { items } = await obtenerEquipoCompleto();
    const actual = items.find((e) => String(e.id) === String(id));

    if (!actual) {
      return res.status(404).json({
        status: 'error',
        message: `Estilista con ID '${id}' no encontrado.`,
      });
    }

    const store = leerMetaStore();
    const idKey = String(actual.id);

    const nombre = req.body.nombre !== undefined ? String(req.body.nombre).trim() : actual.nombre;
    const apellido =
      req.body.apellido !== undefined ? String(req.body.apellido || '').trim() : actual.apellido;
    const especialidad =
      req.body.especialidad !== undefined
        ? String(req.body.especialidad || '').trim()
        : actual.especialidad;
    const bioRaw = req.body.bio !== undefined ? req.body.bio : req.body.descripcion;
    const bio = bioRaw !== undefined ? String(bioRaw || '').trim() : actual.bio;
    const nivel =
      req.body.nivel !== undefined && req.body.nivel !== ''
        ? String(req.body.nivel).trim().toLowerCase()
        : actual.nivel;
    const activo = req.body.activo !== undefined ? Boolean(req.body.activo) : actual.activo;
    const orden =
      req.body.orden !== undefined && req.body.orden !== null && req.body.orden !== ''
        ? Number(req.body.orden)
        : actual.orden;
    const servicios_ids = Array.isArray(req.body.servicios_ids)
      ? req.body.servicios_ids
      : actual.servicios_ids || [];

    let foto_url =
      req.body.foto_url !== undefined ? String(req.body.foto_url || '').trim() : actual.foto_url;

    if (req.body.imagen_base64) {
      const savedPath = guardarImagenBase64(req.body.imagen_base64, `${nombre}_${apellido}`);
      if (savedPath) foto_url = savedPath;
    }
    if (!foto_url) {
      foto_url = actual.foto_url || DEFAULT_FALLBACK_FOTO;
    }

    let updatedRow = null;
    let source = 'mock';

    if (supabase && !String(actual.id).startsWith('e-')) {
      const candidateUpdates = [
        { nombre, apellido, especialidad, bio, foto_url, nivel, activo },
        { nombre, apellido, especialidad, bio, nivel, activo },
        { nombre, apellido, especialidad, activo },
      ];

      for (const candidate of candidateUpdates) {
        try {
          const { data, error } = await supabase
            .from('estilistas')
            .update(candidate)
            .eq('id', isNaN(actual.id) ? actual.id : Number(actual.id))
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

    if (Array.isArray(store.mockItems)) {
      store.mockItems = store.mockItems.map((item) =>
        String(item.id) === idKey
          ? {
              ...item,
              nombre,
              apellido,
              especialidad,
              bio,
              foto_url,
              nivel,
              activo,
              orden,
              servicios_ids,
              updated_at: new Date().toISOString(),
            }
          : item
      );
    }

    store.byId[idKey] = {
      ...(store.byId[idKey] || {}),
      nombre,
      apellido,
      especialidad,
      bio,
      foto_url,
      nivel,
      activo,
      orden,
      servicios_ids,
    };
    guardarMetaStore(store);

    const estilistaFinal = enriquecerEstilista(updatedRow || actual, store);

    return res.status(200).json({
      status: 'success',
      source,
      message: 'Miembro del equipo actualizado exitosamente.',
      data: estilistaFinal,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/estilistas/:id/visibilidad
 * Conmutar rápidamente la visibilidad (activo) de un miembro del equipo (solo Admin).
 */
const toggleVisibilidadEstilista = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const { items } = await obtenerEquipoCompleto();
    const actual = items.find((e) => String(e.id) === String(id));

    if (!actual) {
      return res.status(404).json({
        status: 'error',
        message: `Estilista con ID '${id}' no encontrado.`,
      });
    }

    const nuevoActivo =
      req.body && req.body.activo !== undefined ? Boolean(req.body.activo) : !actual.activo;

    const store = leerMetaStore();
    const idKey = String(actual.id);
    let source = 'mock';

    if (supabase && !String(actual.id).startsWith('e-')) {
      try {
        const { error } = await supabase
          .from('estilistas')
          .update({ activo: nuevoActivo })
          .eq('id', isNaN(actual.id) ? actual.id : Number(actual.id));
        if (!error) source = 'supabase';
      } catch (_) {}
    }

    if (Array.isArray(store.mockItems)) {
      store.mockItems = store.mockItems.map((item) =>
        String(item.id) === idKey ? { ...item, activo: nuevoActivo } : item
      );
    }

    store.byId[idKey] = {
      ...(store.byId[idKey] || {}),
      activo: nuevoActivo,
    };
    guardarMetaStore(store);

    const estilistaFinal = enriquecerEstilista({ ...actual, activo: nuevoActivo }, store);

    return res.status(200).json({
      status: 'success',
      source,
      message: `Visibilidad actualizada: ${estilistaFinal.nombre} está ${nuevoActivo ? 'visible' : 'oculto'}.`,
      data: estilistaFinal,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/estilistas/:id
 * Eliminar un miembro del equipo (solo Admin).
 */
const eliminarEstilista = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const { items } = await obtenerEquipoCompleto();
    const actual = items.find((e) => String(e.id) === String(id));

    if (!actual) {
      return res.status(404).json({
        status: 'error',
        message: `Estilista con ID '${id}' no encontrado.`,
      });
    }

    const store = leerMetaStore();
    const idKey = String(actual.id);
    let source = 'mock';

    if (supabase && !String(actual.id).startsWith('e-')) {
      try {
        const { error } = await supabase
          .from('estilistas')
          .delete()
          .eq('id', isNaN(actual.id) ? actual.id : Number(actual.id));
        if (!error) {
          source = 'supabase';
        } else {
          // Si tiene reservas asociadas (ON DELETE RESTRICT), desactivar en Supabase y ocultar localmente
          await supabase
            .from('estilistas')
            .update({ activo: false })
            .eq('id', isNaN(actual.id) ? actual.id : Number(actual.id));
        }
      } catch (_) {}
    }

    if (Array.isArray(store.mockItems)) {
      store.mockItems = store.mockItems.filter((item) => String(item.id) !== idKey);
    }
    delete store.byId[idKey];
    store.deletedIds[idKey] = true;
    guardarMetaStore(store);

    return res.status(200).json({
      status: 'success',
      source,
      message: 'Miembro del equipo eliminado exitosamente.',
      data: { id: actual.id },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEstilistas,
  getEstilistaById,
  getServiciosPorEstilista,
  crearEstilista,
  actualizarEstilista,
  toggleVisibilidadEstilista,
  eliminarEstilista,
  subirImagenEstilista,
  obtenerEquipoCompleto,
  estilistaCorrespondeAServicio,
};

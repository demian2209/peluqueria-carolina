const CATEGORIAS_VALIDAS = [
  'coloracion',
  'corte',
  'barberia',
  'tratamiento',
  'styling',
  'manicura',
];

/**
 * Valida y sanitiza el payload para creación (POST) o edición completa (PUT) de un servicio.
 */
const validarCrearServicio = (req, res, next) => {
  const {
    nombre,
    descripcion,
    duracion_min,
    precio,
    categoria,
    activo,
    en_seleccion,
    orden,
    imagen_url,
    imagen_base64,
    etiqueta,
    icono,
    destacado,
  } = req.body || {};

  const errores = [];

  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 3 || nombre.trim().length > 100) {
    errores.push('El nombre del servicio es obligatorio y debe tener entre 3 y 100 caracteres.');
  }

  if (descripcion !== undefined && descripcion !== null && typeof descripcion !== 'string') {
    errores.push('La descripción debe ser una cadena de texto válida.');
  } else if (typeof descripcion === 'string' && descripcion.trim().length > 800) {
    errores.push('La descripción no puede superar los 800 caracteres.');
  }

  const duracionNum = Number(duracion_min);
  if (!Number.isInteger(duracionNum) || duracionNum <= 0 || duracionNum > 600) {
    errores.push('La duración (duracion_min) debe ser un número entero entre 1 y 600 minutos.');
  }

  const precioNum = Number(precio);
  if (precio === undefined || precio === null || precio === '' || Number.isNaN(precioNum) || precioNum < 0) {
    errores.push('El precio debe ser un valor numérico mayor o igual a 0.');
  }

  const catClean = typeof categoria === 'string' ? categoria.trim().toLowerCase() : '';
  if (!catClean || !CATEGORIAS_VALIDAS.includes(catClean)) {
    errores.push(`La categoría es obligatoria y debe ser una de: ${CATEGORIAS_VALIDAS.join(', ')}.`);
  }

  if (orden !== undefined && orden !== null && orden !== '') {
    const ordenNum = Number(orden);
    if (!Number.isInteger(ordenNum) || ordenNum < 0) {
      errores.push('El orden de visualización debe ser un número entero mayor o igual a 0.');
    }
  }

  if (activo !== undefined && typeof activo !== 'boolean') {
    errores.push('El campo activo debe ser booleano (true/false).');
  }

  if (en_seleccion !== undefined && typeof en_seleccion !== 'boolean') {
    errores.push('El campo en_seleccion debe ser booleano (true/false).');
  }

  if (destacado !== undefined && typeof destacado !== 'boolean') {
    errores.push('El campo destacado debe ser booleano (true/false).');
  }

  if (etiqueta !== undefined && etiqueta !== null && typeof etiqueta === 'string' && etiqueta.trim().length > 120) {
    errores.push('La etiqueta editorial no puede superar los 120 caracteres.');
  }

  if (icono !== undefined && icono !== null && typeof icono === 'string' && icono.trim().length > 60) {
    errores.push('El identificador de ícono no puede superar los 60 caracteres.');
  }

  if (imagen_url !== undefined && imagen_url !== null && typeof imagen_url !== 'string') {
    errores.push('El campo imagen_url debe ser una cadena de texto válida.');
  }

  if (imagen_base64 !== undefined && imagen_base64 !== null && imagen_base64 !== '') {
    if (typeof imagen_base64 !== 'string' || !/^data:image\/(webp|png|jpeg|jpg|gif);base64,/i.test(imagen_base64)) {
      errores.push('El archivo adjunto (imagen_base64) debe ser una imagen válida en formato WebP, PNG, JPEG o GIF.');
    }
  }

  if (errores.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: errores[0],
      errors: errores,
    });
  }

  next();
};

/**
 * Valida y sanitiza el payload para actualización parcial (PATCH) de un servicio.
 */
const validarActualizarServicio = (req, res, next) => {
  const body = req.body || {};
  const keys = Object.keys(body);

  if (keys.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Se requiere al menos un campo para actualizar el servicio.',
    });
  }

  const errores = [];

  if (body.nombre !== undefined) {
    if (typeof body.nombre !== 'string' || body.nombre.trim().length < 3 || body.nombre.trim().length > 100) {
      errores.push('El nombre del servicio debe tener entre 3 y 100 caracteres.');
    }
  }

  if (body.descripcion !== undefined && body.descripcion !== null) {
    if (typeof body.descripcion !== 'string' || body.descripcion.trim().length > 800) {
      errores.push('La descripción debe ser texto de máximo 800 caracteres.');
    }
  }

  if (body.duracion_min !== undefined) {
    const duracionNum = Number(body.duracion_min);
    if (!Number.isInteger(duracionNum) || duracionNum <= 0 || duracionNum > 600) {
      errores.push('La duración debe ser un número entero entre 1 y 600 minutos.');
    }
  }

  if (body.precio !== undefined) {
    const precioNum = Number(body.precio);
    if (body.precio === null || body.precio === '' || Number.isNaN(precioNum) || precioNum < 0) {
      errores.push('El precio debe ser un valor numérico mayor o igual a 0.');
    }
  }

  if (body.categoria !== undefined) {
    const catClean = typeof body.categoria === 'string' ? body.categoria.trim().toLowerCase() : '';
    if (!CATEGORIAS_VALIDAS.includes(catClean)) {
      errores.push(`La categoría debe ser una de: ${CATEGORIAS_VALIDAS.join(', ')}.`);
    }
  }

  if (body.orden !== undefined && body.orden !== null && body.orden !== '') {
    const ordenNum = Number(body.orden);
    if (!Number.isInteger(ordenNum) || ordenNum < 0) {
      errores.push('El orden de visualización debe ser un número entero mayor o igual a 0.');
    }
  }

  if (body.activo !== undefined && typeof body.activo !== 'boolean') {
    errores.push('El campo activo debe ser booleano (true/false).');
  }

  if (body.en_seleccion !== undefined && typeof body.en_seleccion !== 'boolean') {
    errores.push('El campo en_seleccion debe ser booleano (true/false).');
  }

  if (body.destacado !== undefined && typeof body.destacado !== 'boolean') {
    errores.push('El campo destacado debe ser booleano (true/false).');
  }

  if (body.imagen_base64 !== undefined && body.imagen_base64 !== null && body.imagen_base64 !== '') {
    if (
      typeof body.imagen_base64 !== 'string' ||
      !/^data:image\/(webp|png|jpeg|jpg|gif);base64,/i.test(body.imagen_base64)
    ) {
      errores.push('El archivo adjunto (imagen_base64) debe ser una imagen válida (WebP, PNG, JPEG o GIF).');
    }
  }

  if (errores.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: errores[0],
      errors: errores,
    });
  }

  next();
};

module.exports = {
  CATEGORIAS_VALIDAS,
  validarCrearServicio,
  validarActualizarServicio,
};


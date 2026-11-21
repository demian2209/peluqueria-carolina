const NIVELES_VALIDOS = ['artisan', 'senior', 'master'];

/**
 * Valida y sanitiza el payload para creación (POST) o edición completa (PUT) de un miembro del equipo.
 */
const validarCrearEstilista = (req, res, next) => {
  const {
    nombre,
    apellido,
    especialidad,
    bio,
    descripcion,
    nivel,
    activo,
    orden,
    foto_url,
    imagen_base64,
    servicios_ids,
  } = req.body || {};

  const errores = [];

  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.trim().length > 100) {
    errores.push('El nombre del estilista es obligatorio y debe tener entre 2 y 100 caracteres.');
  }

  if (apellido !== undefined && apellido !== null) {
    if (typeof apellido !== 'string' || apellido.trim().length > 100) {
      errores.push('El apellido debe ser una cadena de texto de máximo 100 caracteres.');
    }
  }

  if (especialidad !== undefined && especialidad !== null) {
    if (typeof especialidad !== 'string' || especialidad.trim().length > 120) {
      errores.push('La especialidad debe ser texto de máximo 120 caracteres.');
    }
  }

  const textoBio = bio !== undefined ? bio : descripcion;
  if (textoBio !== undefined && textoBio !== null) {
    if (typeof textoBio !== 'string' || textoBio.trim().length > 800) {
      errores.push('La descripción no puede superar los 800 caracteres.');
    }
  }

  if (nivel !== undefined && nivel !== null && nivel !== '') {
    const nivelClean = typeof nivel === 'string' ? nivel.trim().toLowerCase() : '';
    if (!NIVELES_VALIDOS.includes(nivelClean)) {
      errores.push(`El nivel debe ser uno de: ${NIVELES_VALIDOS.join(', ')}.`);
    }
  }

  if (orden !== undefined && orden !== null && orden !== '') {
    const ordenNum = Number(orden);
    if (!Number.isInteger(ordenNum) || ordenNum < 0) {
      errores.push('El orden de visualización debe ser un número entero mayor o igual a 0.');
    }
  }

  if (activo !== undefined && typeof activo !== 'boolean') {
    errores.push('El campo activo (visibilidad) debe ser booleano (true/false).');
  }

  if (foto_url !== undefined && foto_url !== null && typeof foto_url !== 'string') {
    errores.push('El campo foto_url debe ser una cadena de texto válida.');
  }

  if (imagen_base64 !== undefined && imagen_base64 !== null && imagen_base64 !== '') {
    if (
      typeof imagen_base64 !== 'string' ||
      !/^data:image\/(webp|png|jpeg|jpg|gif);base64,/i.test(imagen_base64)
    ) {
      errores.push('El archivo adjunto (imagen_base64) debe ser una imagen válida en formato WebP, PNG, JPEG o GIF.');
    }
  }

  if (servicios_ids !== undefined && servicios_ids !== null) {
    if (!Array.isArray(servicios_ids)) {
      errores.push('El campo servicios_ids debe ser un arreglo de identificadores de servicio.');
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
 * Valida y sanitiza el payload para actualización parcial (PATCH) de un miembro del equipo.
 */
const validarActualizarEstilista = (req, res, next) => {
  const body = req.body || {};
  const keys = Object.keys(body);

  if (keys.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Se requiere al menos un campo para actualizar al miembro del equipo.',
    });
  }

  const errores = [];

  if (body.nombre !== undefined) {
    if (typeof body.nombre !== 'string' || body.nombre.trim().length < 2 || body.nombre.trim().length > 100) {
      errores.push('El nombre del estilista debe tener entre 2 y 100 caracteres.');
    }
  }

  if (body.apellido !== undefined && body.apellido !== null) {
    if (typeof body.apellido !== 'string' || body.apellido.trim().length > 100) {
      errores.push('El apellido debe ser texto de máximo 100 caracteres.');
    }
  }

  if (body.especialidad !== undefined && body.especialidad !== null) {
    if (typeof body.especialidad !== 'string' || body.especialidad.trim().length > 120) {
      errores.push('La especialidad debe ser texto de máximo 120 caracteres.');
    }
  }

  const textoBio = body.bio !== undefined ? body.bio : body.descripcion;
  if (textoBio !== undefined && textoBio !== null) {
    if (typeof textoBio !== 'string' || textoBio.trim().length > 800) {
      errores.push('La descripción no puede superar los 800 caracteres.');
    }
  }

  if (body.nivel !== undefined && body.nivel !== null && body.nivel !== '') {
    const nivelClean = typeof body.nivel === 'string' ? body.nivel.trim().toLowerCase() : '';
    if (!NIVELES_VALIDOS.includes(nivelClean)) {
      errores.push(`El nivel debe ser uno de: ${NIVELES_VALIDOS.join(', ')}.`);
    }
  }

  if (body.orden !== undefined && body.orden !== null && body.orden !== '') {
    const ordenNum = Number(body.orden);
    if (!Number.isInteger(ordenNum) || ordenNum < 0) {
      errores.push('El orden de visualización debe ser un número entero mayor o igual a 0.');
    }
  }

  if (body.activo !== undefined && typeof body.activo !== 'boolean') {
    errores.push('El campo activo (visibilidad) debe ser booleano (true/false).');
  }

  if (body.foto_url !== undefined && body.foto_url !== null && typeof body.foto_url !== 'string') {
    errores.push('El campo foto_url debe ser una cadena de texto válida.');
  }

  if (body.imagen_base64 !== undefined && body.imagen_base64 !== null && body.imagen_base64 !== '') {
    if (
      typeof body.imagen_base64 !== 'string' ||
      !/^data:image\/(webp|png|jpeg|jpg|gif);base64,/i.test(body.imagen_base64)
    ) {
      errores.push('El archivo adjunto (imagen_base64) debe ser una imagen válida (WebP, PNG, JPEG o GIF).');
    }
  }

  if (body.servicios_ids !== undefined && body.servicios_ids !== null && !Array.isArray(body.servicios_ids)) {
    errores.push('El campo servicios_ids debe ser un arreglo.');
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
  NIVELES_VALIDOS,
  validarCrearEstilista,
  validarActualizarEstilista,
};

/**
 * Middleware de validación para el cuerpo de la solicitud de reserva.
 * Retorna 422 con lista de errores si algún campo es inválido.
 */
const validarReserva = (req, res, next) => {
  const { cliente_nombre, cliente_email, estilista_id, servicio_id, fecha, hora_inicio } = req.body;
  const errores = [];

  if (!cliente_nombre || typeof cliente_nombre !== 'string' || cliente_nombre.trim().length < 2) {
    errores.push('cliente_nombre es obligatorio y debe tener al menos 2 caracteres.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cliente_email || !emailRegex.test(cliente_email)) {
    errores.push('cliente_email debe ser una dirección de correo válida.');
  }

  if (!estilista_id || typeof estilista_id !== 'string') {
    errores.push('estilista_id es obligatorio.');
  }

  if (!servicio_id || typeof servicio_id !== 'string') {
    errores.push('servicio_id es obligatorio.');
  }

  const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!fecha || !fechaRegex.test(fecha)) {
    errores.push('fecha debe tener el formato YYYY-MM-DD.');
  }

  const timeRegex = /^\d{2}:\d{2}$/;
  if (!hora_inicio || !timeRegex.test(hora_inicio)) {
    errores.push('hora_inicio debe tener el formato HH:MM.');
  }

  if (errores.length > 0) {
    return res.status(422).json({
      status: 'error',
      message: 'Los datos de la reserva son inválidos.',
      errores,
    });
  }

  next();
};

module.exports = { validarReserva };

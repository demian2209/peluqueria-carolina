/**
 * Utilidades para el motor de disponibilidad.
 * Toda la lógica de cálculo de slots libres vive aquí,
 * manteniendo los controladores limpios y el código testeable.
 */

/**
 * Convierte "HH:MM" o "HH:MM:SS" a minutos desde medianoche.
 * @param {string} timeStr
 * @returns {number}
 */
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Convierte minutos desde medianoche a string "HH:MM".
 * @param {number} minutes
 * @returns {string}
 */
const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Obtiene el número de día de la semana de un string de fecha "YYYY-MM-DD".
 * Usa UTC para evitar desfases de zona horaria.
 * 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
 * @param {string} dateStr
 * @returns {number}
 */
const getDayOfWeek = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

/**
 * Genera todos los posibles slots de inicio dentro de un bloque horario,
 * separados según la duración del servicio (o `interval` si se especifica explícitamente).
 * @param {number} workStart  - inicio en minutos desde medianoche
 * @param {number} workEnd    - fin en minutos desde medianoche
 * @param {number} duration   - duración del servicio en minutos
 * @param {number} [interval] - granularidad de los slots (default: duration del servicio)
 * @returns {Array<{start: number, end: number}>}
 */
const generateCandidateSlots = (workStart, workEnd, duration, interval = duration) => {
  const step = interval && interval > 0 ? interval : duration;
  if (!step || step <= 0 || !duration || duration <= 0) return [];
  const slots = [];
  for (let start = workStart; start + duration <= workEnd; start += step) {
    slots.push({ start, end: start + duration });
  }
  return slots;
};

/**
 * Elimina candidatos que colisionen con reservas existentes.
 * Un candidato colisiona si su rango [start, end) solapa con alguna reserva.
 * @param {Array<{start, end}>} candidates
 * @param {Array<{hora_inicio: string, hora_fin: string}>} bookings
 * @returns {Array<{start, end}>}
 */
const filterConflicts = (candidates, bookings) => {
  const occupied = bookings.map((b) => ({
    start: timeToMinutes(b.hora_inicio),
    end: timeToMinutes(b.hora_fin),
  }));

  return candidates.filter(({ start, end }) =>
    occupied.every((b) => end <= b.start || start >= b.end)
  );
};

/**
 * Obtiene la fecha ("YYYY-MM-DD") y hora ("HH:MM", minutos desde medianoche)
 * actual del sistema en la zona horaria operativa (America/Santiago).
 * Permite inyectar `nowDate` opcional para pruebas determinísticas.
 *
 * @param {Date} [nowDate]
 * @returns {{ fechaHoy: string, horaActual: string, minutosActuales: number }}
 */
const obtenerFechaHoraSistema = (nowDate = new Date()) => {
  const d = nowDate instanceof Date ? nowDate : new Date(nowDate);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    const rawHour = parts.find((p) => p.type === 'hour')?.value || '00';
    const hour = (rawHour === '24' ? '00' : rawHour).padStart(2, '0');
    const minute = (parts.find((p) => p.type === 'minute')?.value || '00').padStart(2, '0');

    const fechaHoy = `${year}-${month}-${day}`;
    const horaActual = `${hour}:${minute}`;
    return {
      fechaHoy,
      horaActual,
      minutosActuales: timeToMinutes(horaActual),
    };
  } catch (_) {
    const pad = (n) => String(n).padStart(2, '0');
    const fechaHoy = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const horaActual = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return {
      fechaHoy,
      horaActual,
      minutosActuales: timeToMinutes(horaActual),
    };
  }
};

/**
 * Resuelve el identificador canónico del estilista ("e1-carolina-valenzuela"..."e5-valentina-morales")
 * a partir de su ID (numérico o string) o de su nombre completo.
 *
 * @param {string|number} estilistaId
 * @param {string} [nombreCompleto]
 * @returns {string}
 */
const resolverEstilistaMockId = (estilistaId = '', nombreCompleto = '') => {
  const idStr = String(estilistaId || '').trim();
  const estMockMap = {
    '1': 'e1-carolina-valenzuela',
    '2': 'e2-matias-munoz',
    '3': 'e3-camila-soto',
    '4': 'e4-gonzalo-riquelme',
    '5': 'e5-valentina-morales',
  };
  if (estMockMap[idStr]) return estMockMap[idStr];
  if (Object.values(estMockMap).includes(idStr)) return idStr;

  const norm = `${idStr} ${nombreCompleto || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('carolina')) return 'e1-carolina-valenzuela';
  if (norm.includes('matias')) return 'e2-matias-munoz';
  if (norm.includes('camila')) return 'e3-camila-soto';
  if (norm.includes('gonzalo')) return 'e4-gonzalo-riquelme';
  if (norm.includes('valentina')) return 'e5-valentina-morales';

  return idStr;
};

/**
 * Evalúa si un rango [startMin, endMin) colisiona con una lista de bloqueos administrativos
 * ya filtrados para la fecha y estilista correspondientes.
 *
 * @param {object} params
 * @param {Array}  params.bloqueos  - bloqueos activos aplicables al día y estilista
 * @param {number} params.startMin  - inicio del slot en minutos
 * @param {number} params.endMin    - fin del slot en minutos
 * @returns {{ bloqueado: boolean, diaCompleto: boolean, motivo: string, bloqueo: object|null }}
 */
const evaluarBloqueoParaSlot = ({ bloqueos = [], startMin, endMin }) => {
  if (!Array.isArray(bloqueos) || bloqueos.length === 0) {
    return { bloqueado: false, diaCompleto: false, motivo: '', bloqueo: null };
  }

  const bloqueoDiaCompleto = bloqueos.find((b) => b && b.activo !== false && b.dia_completo === true);
  if (bloqueoDiaCompleto) {
    return {
      bloqueado: true,
      diaCompleto: true,
      motivo: bloqueoDiaCompleto.motivo || 'Día bloqueado por administración',
      bloqueo: bloqueoDiaCompleto,
    };
  }

  for (const b of bloqueos) {
    if (!b || b.activo === false || !b.hora_inicio || !b.hora_fin) continue;
    const bStart = timeToMinutes(b.hora_inicio);
    const bEnd = timeToMinutes(b.hora_fin);
    if (Number.isNaN(bStart) || Number.isNaN(bEnd)) continue;
    // Hay solapamiento si NOT (endMin <= bStart || startMin >= bEnd)
    if (!(endMin <= bStart || startMin >= bEnd)) {
      return {
        bloqueado: true,
        diaCompleto: false,
        motivo: b.motivo || `Horario bloqueado (${b.hora_inicio}–${b.hora_fin})`,
        bloqueo: b,
      };
    }
  }

  return { bloqueado: false, diaCompleto: false, motivo: '', bloqueo: null };
};

/**
 * Función principal: calcula slots disponibles para un estilista, fecha y duración.
 * Considera estrictamente la fecha y hora actual del sistema:
 * si `fecha` es hoy, filtra todo horario <= hora actual del sistema.
 * También descarta cualquier día u horario bloqueado administrativamente.
 * El paso entre bloques horarios coincide por defecto con `duracionMin` (la duración real del servicio).
 *
 * @param {object} params
 * @param {string} params.fecha         - "YYYY-MM-DD"
 * @param {number} params.duracionMin   - duración del servicio en minutos
 * @param {Array}  params.horarios      - horario semanal del estilista
 *                   [{ dia_semana: number, hora_inicio: string, hora_fin: string }]
 * @param {Array}  params.reservas      - reservas confirmadas/pendientes del día
 *                   [{ hora_inicio: string, hora_fin: string }]
 * @param {Array}  [params.bloqueos]    - bloqueos administrativos activos del día y estilista
 * @param {number} [params.intervalMin] - granularidad de slots (default: duracionMin)
 * @param {Date}   [params.nowDate]     - instante de referencia opcional (default: new Date())
 * @returns {{ slots: string[], trabajaEseDia: boolean, bloqueadoDiaCompleto: boolean, motivoBloqueo: string|null }}
 */
const calcularDisponibilidad = ({
  fecha,
  duracionMin,
  horarios,
  reservas,
  bloqueos = [],
  intervalMin,
  nowDate,
}) => {
  const { fechaHoy, minutosActuales } = obtenerFechaHoraSistema(nowDate);

  if (fecha < fechaHoy) {
    return { slots: [], trabajaEseDia: false, bloqueadoDiaCompleto: false, motivoBloqueo: null };
  }

  const esHoy = fecha === fechaHoy;
  const diaSemana = getDayOfWeek(fecha);
  const stepMin = intervalMin && intervalMin > 0 ? intervalMin : duracionMin;

  // Filtrar horarios del día de la semana solicitado
  const horariosDelDia = horarios.filter((h) => Number(h.dia_semana) === diaSemana);

  if (horariosDelDia.length === 0) {
    return { slots: [], trabajaEseDia: false, bloqueadoDiaCompleto: false, motivoBloqueo: null };
  }

  // Verificar bloqueo de día completo
  const bloqueosActivos = Array.isArray(bloqueos)
    ? bloqueos.filter((b) => b && b.activo !== false)
    : [];

  const bloqueoFullDay = bloqueosActivos.find((b) => b.dia_completo === true);
  if (bloqueoFullDay) {
    return {
      slots: [],
      trabajaEseDia: true,
      bloqueadoDiaCompleto: true,
      motivoBloqueo: bloqueoFullDay.motivo || 'Día bloqueado por administración',
    };
  }

  // Combinar reservas existentes con bloqueos parciales de rango horario
  const bloqueosParciales = bloqueosActivos
    .filter((b) => !b.dia_completo && b.hora_inicio && b.hora_fin)
    .map((b) => ({
      hora_inicio: b.hora_inicio,
      hora_fin: b.hora_fin,
    }));

  const conflictos = [...(Array.isArray(reservas) ? reservas : []), ...bloqueosParciales];

  const allSlots = [];

  for (const bloque of horariosDelDia) {
    const workStart = timeToMinutes(bloque.hora_inicio);
    const workEnd = timeToMinutes(bloque.hora_fin);

    const candidates = generateCandidateSlots(workStart, workEnd, duracionMin, stepMin);
    const available = filterConflicts(candidates, conflictos);

    for (const slot of available) {
      // Condición obligatoria: en la fecha actual, solo ofrecer bloques estrictamente posteriores a la hora actual
      if (esHoy && slot.start <= minutosActuales) {
        continue;
      }
      allSlots.push(minutesToTime(slot.start));
    }
  }

  return {
    slots: allSlots,
    trabajaEseDia: true,
    bloqueadoDiaCompleto: false,
    motivoBloqueo: null,
  };
};

module.exports = {
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  generateCandidateSlots,
  filterConflicts,
  obtenerFechaHoraSistema,
  resolverEstilistaMockId,
  evaluarBloqueoParaSlot,
  calcularDisponibilidad,
};

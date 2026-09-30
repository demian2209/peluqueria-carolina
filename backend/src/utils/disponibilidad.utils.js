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
 * separados por INTERVAL_MIN minutos.
 * @param {number} workStart  - inicio en minutos desde medianoche
 * @param {number} workEnd    - fin en minutos desde medianoche
 * @param {number} duration   - duración del servicio en minutos
 * @param {number} interval   - granularidad de los slots (default: 30 min)
 * @returns {Array<{start: number, end: number}>}
 */
const generateCandidateSlots = (workStart, workEnd, duration, interval = 30) => {
  const slots = [];
  for (let start = workStart; start + duration <= workEnd; start += interval) {
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
 * Función principal: calcula slots disponibles para un estilista, fecha y duración.
 *
 * @param {object} params
 * @param {string} params.fecha         - "YYYY-MM-DD"
 * @param {number} params.duracionMin   - duración del servicio en minutos
 * @param {Array}  params.horarios      - horario semanal del estilista
 *                   [{ dia_semana: number, hora_inicio: string, hora_fin: string }]
 * @param {Array}  params.reservas      - reservas confirmadas/pendientes del día
 *                   [{ hora_inicio: string, hora_fin: string }]
 * @param {number} params.intervalMin   - granularidad de slots (default: 30 min)
 * @returns {{ slots: string[], trabajaEseDia: boolean }}
 */
const calcularDisponibilidad = ({
  fecha,
  duracionMin,
  horarios,
  reservas,
  intervalMin = 30,
}) => {
  const diaSemana = getDayOfWeek(fecha);

  // Filtrar horarios del día de la semana solicitado
  const horariosDelDia = horarios.filter((h) => h.dia_semana === diaSemana);

  if (horariosDelDia.length === 0) {
    return { slots: [], trabajaEseDia: false };
  }

  const allSlots = [];

  for (const bloque of horariosDelDia) {
    const workStart = timeToMinutes(bloque.hora_inicio);
    const workEnd = timeToMinutes(bloque.hora_fin);

    const candidates = generateCandidateSlots(workStart, workEnd, duracionMin, intervalMin);
    const available = filterConflicts(candidates, reservas);

    for (const slot of available) {
      allSlots.push(minutesToTime(slot.start));
    }
  }

  return { slots: allSlots, trabajaEseDia: true };
};

module.exports = {
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  generateCandidateSlots,
  filterConflicts,
  calcularDisponibilidad,
};

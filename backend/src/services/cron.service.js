const { cerrarCitasCumplidasInternal } = require('../controllers/reservas.controller');

let cronTimer = null;

/**
 * Inicializa el worker periódico para el cierre automático de citas cumplidas (Pilar D).
 * Se ejecuta en segundo plano sin bloquear el loop de eventos de Node.js.
 */
const iniciarCronWorkers = () => {
  if (process.env.DISABLE_CRON === 'true') {
    console.log('[CronWorker] ⏸️ Workers automáticos deshabilitados por configuración (DISABLE_CRON=true).');
    return;
  }

  // Intervalo por defecto: cada 15 minutos (900.000 ms)
  const INTERVALO_MS = Number(process.env.CRON_INTERVAL_MS) || 15 * 60 * 1000;
  console.log(`[CronWorker] ⏰ Worker de cierre de citas cumplidas activo (frecuencia: cada ${INTERVALO_MS / 60000} min).`);

  cronTimer = setInterval(async () => {
    try {
      const res = await cerrarCitasCumplidasInternal();
      if (res && res.total_procesadas > 0) {
        console.log(`[CronWorker] ✅ Se cerraron automáticamente ${res.total_procesadas} citas cumplidas.`);
      }
    } catch (err) {
      console.error(`[CronWorker] ⚠️ Error en barrido de citas: ${err.message}`);
    }
  }, INTERVALO_MS);

  if (cronTimer && cronTimer.unref) {
    cronTimer.unref();
  }
};

const detenerCronWorkers = () => {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
  }
};

module.exports = {
  iniciarCronWorkers,
  detenerCronWorkers,
};

const express = require('express');
const router = express.Router();
const healthRoutes = require('./health.routes');
const serviciosRoutes = require('./servicios.routes');
const estilistasRoutes = require('./estilistas.routes');
const disponibilidadRoutes = require('./disponibilidad.routes');
const bloqueosRoutes = require('./bloqueos.routes');
const reservasRoutes = require('./reservas.routes');
const encuestasRoutes = require('./encuestas.routes');
const authRoutes = require('./auth.routes');
const asistenteRoutes = require('./asistente.routes');

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/servicios', serviciosRoutes);
router.use('/estilistas', estilistasRoutes);
router.use('/disponibilidad', disponibilidadRoutes);
router.use('/bloqueos', bloqueosRoutes);
router.use('/reservas', reservasRoutes);
router.use('/encuestas', encuestasRoutes);
router.use('/asistente', asistenteRoutes);

module.exports = router;


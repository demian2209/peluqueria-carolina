const express = require('express');
const router = express.Router();
const healthRoutes = require('./health.routes');
const serviciosRoutes = require('./servicios.routes');
const estilistasRoutes = require('./estilistas.routes');
const disponibilidadRoutes = require('./disponibilidad.routes');
const reservasRoutes = require('./reservas.routes');
const authRoutes = require('./auth.routes');

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/servicios', serviciosRoutes);
router.use('/estilistas', estilistasRoutes);
router.use('/disponibilidad', disponibilidadRoutes);
router.use('/reservas', reservasRoutes);

module.exports = router;


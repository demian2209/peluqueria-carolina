const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const notFoundHandler = require('./middlewares/notFoundHandler');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares de seguridad y utilidad
app.use(helmet());

// Orígenes autorizados en desarrollo y redes locales privadas (celulares/tablets en la misma WiFi)
const isLocalOrPrivateNetwork = (origin) => {
  if (!origin) return true;
  return (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)
  );
};

app.use(
  cors({
    origin: (origin, callback) => {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      const isDev = process.env.NODE_ENV !== 'production';
      if (!origin || origin === clientUrl || (isDev && isLocalOrPrivateNetwork(origin))) {
        return callback(null, true);
      }
      return callback(new Error('Origen no autorizado por política CORS'));
    },
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Parser con límite ampliado (8mb) exclusivamente para subida de imágenes en administración de servicios
app.use('/api/v1/servicios', express.json({ limit: '8mb' }));

// Parser global restringido (256kb) para mitigar ataques DoS de agotamiento de memoria,
// conservando rawBody en el webhook de WhatsApp para verificación de firma HMAC-SHA256
app.use(
  express.json({
    limit: '256kb',
    verify: (req, _res, buf) => {
      if (req.originalUrl && req.originalUrl.includes('/whatsapp-webhook')) {
        req.rawBody = Buffer.from(buf);
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Rutas base API v1
app.use('/api/v1', routes);

// Middleware 404 y Manejador Global de Errores
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

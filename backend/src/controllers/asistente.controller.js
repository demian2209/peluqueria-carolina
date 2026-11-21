const rateLimit = require('express-rate-limit');

/**
 * Rate limiter para proteger la cuota de la API de Gemini
 * y evitar ataques de denegación de servicio o scraping.
 * Permite hasta 25 consultas cada 15 minutos por IP.
 */
const asistenteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Has alcanzado el límite de consultas al asistente. Por favor espera unos minutos antes de volver a preguntar.',
  },
});

/**
 * Controlador para enviar consultas al Asistente IA vía n8n (PC06 Router -> PC07 Gemini)
 * POST /api/v1/asistente/consulta
 */
const consultarAsistente = async (req, res, next) => {
  try {
    const { mensaje } = req.body;

    // 1. Validación estricta de entrada
    if (!mensaje || typeof mensaje !== 'string') {
      return res.status(400).json({
        status: 'fail',
        message: 'El campo "mensaje" es obligatorio y debe ser un texto.',
      });
    }

    const mensajeLimpio = mensaje.trim();

    if (mensajeLimpio.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'El mensaje no puede estar vacío.',
      });
    }

    if (mensajeLimpio.length > 500) {
      return res.status(400).json({
        status: 'fail',
        message: 'El mensaje es demasiado largo (máximo 500 caracteres permitidos).',
      });
    }

    // 2. Resolver URL del Webhook Router de n8n
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/pc06-webhook-router';

    // 3. Reenviar consulta a n8n con timeout de seguridad (20s)
    let respuestaIa = '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const n8nHeaders = {
        'Content-Type': 'application/json',
      };
      if (process.env.INTERNAL_API_KEY) {
        n8nHeaders['x-api-key'] = process.env.INTERNAL_API_KEY;
      }

      const n8nResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: n8nHeaders,
        body: JSON.stringify({
          evento: 'consulta_chat',
          mensaje: mensajeLimpio,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!n8nResponse.ok) {
        console.warn(`[Asistente IA] n8n respondió con status ${n8nResponse.status}`);
        return res.status(502).json({
          status: 'error',
          message: 'No fue posible obtener respuesta del motor de inteligencia artificial en este momento.',
          data: {
            respuesta: 'Disculpa, el asistente virtual no está disponible en este momento. Por favor contáctanos directamente o agenda tu cita a través de nuestro catálogo.',
          },
        });
      }

      const n8nData = await n8nResponse.json();

      if (n8nData && n8nData.respuesta) {
        respuestaIa = n8nData.respuesta;
      } else {
        respuestaIa = 'Lo siento, no pude procesar tu consulta adecuadamente. Por favor intenta de nuevo.';
      }

      return res.status(200).json({
        status: 'success',
        data: {
          respuesta: respuestaIa,
        },
      });
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        console.error('[Asistente IA] Timeout al esperar respuesta de n8n/Gemini');
        return res.status(504).json({
          status: 'error',
          message: 'Tiempo de espera agotado al consultar el asistente.',
          data: {
            respuesta: 'El asistente tardó demasiado en responder. Por favor intenta formular una pregunta más breve o contáctanos por WhatsApp.',
          },
        });
      }

      console.error('[Asistente IA] Error de conexión con n8n:', fetchErr.message);
      return res.status(503).json({
        status: 'error',
        message: 'Servicio de automatización n8n no disponible.',
        data: {
          respuesta: 'Nuestro servicio de atención inteligente está temporalmente desconectado. Puedes comunicarte directamente al WhatsApp de Peluquería Carolina.',
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  consultarAsistente,
  asistenteRateLimiter,
};

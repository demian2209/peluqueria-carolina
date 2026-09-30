require('dotenv').config();
const app = require('./app');
const supabase = require('./database/supabaseClient');
const { checkDatabaseConnection } = require('./database/checkConnection');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Verificar conexión a la base de datos antes de abrir el servidor al tráfico
  try {
    await checkDatabaseConnection(supabase);
  } catch (err) {
    console.warn(`⚠️  ${err.message}`);
    console.warn('   El servidor arrancará de todas formas en modo local/offline.');
    console.warn('   Recuerda configurar las variables SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu .env\n');
  }

  const server = app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Servidor Peluquería Carolina`);
    console.log(`📡 Escuchando en el puerto: ${PORT}`);
    console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=================================`);
  });

  // Manejo de errores no capturados
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection Error:', err);
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception Error:', err);
    process.exit(1);
  });
};

startServer();

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');
const app = require('./src/app');
const sb = require('./src/database/supabaseClient');
const { generarTokenAdmin } = require('./src/utils/reservaToken.utils');

async function runTestsPaso3() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: PASO 3 - AUTOMATIZACIÓN 24H (PC02) Y CIERRE (PC05)');
  console.log('================================================================\n');

  const adminToken = generarTokenAdmin(process.env.ADMIN_EMAIL || 'carolina@peluqueria.cl');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1/reservas`;
  console.log(`📡 Servidor de pruebas Express levantado en http://localhost:${port}`);

  const cliente_email = 'peluqueriacarolinasanfernando@gmail.com';
  const cliente_nombre = 'Damián Cáceres';
  const cliente_telefono = '+56952034275';

  // 1. Obtener o crear cliente
  let { data: cliente } = await sb.from('clientes').select('*').eq('email', cliente_email).maybeSingle();
  if (!cliente) {
    const { data: created } = await sb.from('clientes').insert({
      nombre_completo: cliente_nombre,
      email: cliente_email,
      telefono_whatsapp: cliente_telefono,
    }).select().single();
    cliente = created;
  }
  console.log('👤 Cliente de prueba listo ID:', cliente.id);

  async function limpiarReserva(id) {
    if (!id || !sb) return;
    await sb.from('encuestas_satisfaccion').delete().eq('reserva_id', id);
    await sb.from('notificaciones').delete().eq('reserva_id', id);
    await sb.from('reservas').delete().eq('id', id);
  }

  let rPast, rTomorrow;

  try {
    // -----------------------------------------------------------------
    // TEST 1 (Pilar D): Cierre Automático de Cita Vencida y Despacho PC05
    // -----------------------------------------------------------------
    console.log('\n--- 1. Test Pilar D: Cierre Automático de Citas Vencidas (Cron /cerrar-atendidas) ---');
    // Creamos una cita terminada en el pasado reciente (hace 2 horas)
    const now = new Date();
    const pastStart = new Date(now.getTime() - 120 * 60000).toISOString();
    const pastEnd = new Date(now.getTime() - 60 * 60000).toISOString();

    const { data: cPast, error: errPast } = await sb.from('reservas').insert({
      cliente_id: cliente.id,
      estilista_id: 1,
      servicio_id: 2,
      fecha_hora_inicio: pastStart,
      fecha_hora_fin: pastEnd,
      estado: 'confirmada', // aún confirmada, requiere barrido automático
    }).select().single();

    if (errPast) throw new Error(`Error insertando cita pasada: ${errPast.message}`);
    rPast = cPast;
    console.log(`Cita confirmada vencida creada ID #${rPast.id} (Fin: ${pastEnd})`);

    // Invocamos el endpoint de barrido programado
    const resCronCerrar = await fetch(`${baseUrl}/cron/cerrar-atendidas`, {
      method: 'POST',
      headers: authHeaders,
    });
    const dataCronCerrar = await resCronCerrar.json();
    console.log(`Respuesta /cron/cerrar-atendidas (HTTP ${resCronCerrar.status}):`, dataCronCerrar);

    if (resCronCerrar.status !== 200 || !dataCronCerrar.total_procesadas) {
      throw new Error(`Falló barrido de cierre: Se esperaba al menos 1 procesada, recibido: ${JSON.stringify(dataCronCerrar)}`);
    }

    // Verificar en Supabase que el estado cambió a 'atendida'
    const { data: checkPast } = await sb.from('reservas').select('estado').eq('id', rPast.id).single();
    if (checkPast.estado !== 'atendida') {
      throw new Error(`El estado de la reserva #${rPast.id} no cambió a 'atendida'. Estado actual: '${checkPast.estado}'`);
    }
    console.log(`✅ Cita #${rPast.id} transicionó con éxito a estado '${checkPast.estado}'.`);

    // Esperar que n8n procese el webhook pc05-reserva-seguimiento
    console.log('Esperando despacho asíncrono de PC05 hacia WhatsApp y Email...');
    await new Promise((r) => setTimeout(r, 4500));

    const { data: notifsSeg } = await sb.from('notificaciones').select('*').eq('reserva_id', rPast.id);
    console.log(`Notificaciones post-servicio registradas en Supabase: ${notifsSeg.length}`);
    const okSeg = notifsSeg.some((n) => n.tipo === 'seguimiento' && n.estado_envio === 'enviado');
    if (!okSeg) {
      throw new Error('No se registró la notificación de seguimiento en Supabase.');
    }
    console.log('✅ TEST 1 APROBADO: Cita vencida cerrada automáticamente y PC05 activado con éxito.');

    // Verificar idempotencia del barrido
    const resCronIdem = await fetch(`${baseUrl}/cron/cerrar-atendidas`, {
      method: 'POST',
      headers: authHeaders,
    });
    const dataCronIdem = await resCronIdem.json();
    console.log(`Segundo barrido (idempotencia): ${dataCronIdem.total_procesadas} procesadas.`);
    if (dataCronIdem.total_procesadas !== 0) {
      console.warn('⚠️ Se detectaron procesamientos redundantes.');
    } else {
      console.log('🛡️ Barrido 100% idempotente.');
    }

    // -----------------------------------------------------------------
    // TEST 2 (Pilar C): Disparo de Recordatorio 24H (PC02)
    // -----------------------------------------------------------------
    console.log('\n--- 2. Test Pilar C: Recordatorio 24H (/cron/recordatorios-24h) ---');
    const tomorrowStart = new Date(now.getTime() + 24 * 3600000).toISOString();
    const tomorrowEnd = new Date(now.getTime() + 24 * 3600000 + 45 * 60000).toISOString();

    const { data: cTom, error: errTom } = await sb.from('reservas').insert({
      cliente_id: cliente.id,
      estilista_id: 1,
      servicio_id: 2,
      fecha_hora_inicio: tomorrowStart,
      fecha_hora_fin: tomorrowEnd,
      estado: 'confirmada',
    }).select().single();

    if (errTom) throw new Error(`Error insertando cita para mañana: ${errTom.message}`);
    rTomorrow = cTom;
    console.log(`Cita de prueba en ventana 24h creada ID #${rTomorrow.id} (Inicio: ${tomorrowStart})`);

    // Invocamos el endpoint de recordatorios
    const resCronRec = await fetch(`${baseUrl}/cron/recordatorios-24h`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ reserva_id: String(rTomorrow.id) }),
    });
    const dataCronRec = await resCronRec.json();
    console.log(`Respuesta /cron/recordatorios-24h (HTTP ${resCronRec.status}):`, dataCronRec);

    if (resCronRec.status !== 200 || dataCronRec.n8n_status !== 200) {
      throw new Error(`Falló invocación de recordatorio 24h: ${JSON.stringify(dataCronRec)}`);
    }

    console.log('Esperando procesamiento de PC02 en n8n...');
    await new Promise((r) => setTimeout(r, 4500));

    const { data: notifsRec } = await sb.from('notificaciones').select('*').eq('reserva_id', rTomorrow.id);
    console.log(`Notificaciones de recordatorio registradas en Supabase: ${notifsRec.length}`);
    const okRec = notifsRec.some((n) => n.tipo === 'recordatorio' && n.estado_envio === 'enviado');
    if (!okRec) {
      throw new Error('No se registró la notificación enviada de tipo recordatorio en Supabase.');
    }
    console.log('✅ TEST 2 APROBADO: Recordatorio 24h procesado y registrado en Supabase.');

    console.log('\n🎉 ================================================================');
    console.log('🏆 PASO 3 COMPLETADO AL 100%: PILAR C Y D OPERATIVOS Y RESILIENTES');
    console.log('================================================================');
  } finally {
    await limpiarReserva(rPast?.id);
    await limpiarReserva(rTomorrow?.id);
    server.close();
    console.log('🧹 Limpieza de registros de prueba completada.');
  }
}

runTestsPaso3().catch((err) => {
  console.error('\n❌ ERROR EN TEST SUITE PASO 3:', err);
  process.exit(1);
});

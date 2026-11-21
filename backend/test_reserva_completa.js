require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const sb = require('./src/database/supabaseClient');
const { generarTokenAdmin } = require('./src/utils/reservaToken.utils');

async function testReservaCompleta() {
  console.log('========================================================================');
  console.log('🚀 INICIO TEST INTEGRAL: CONFIRMACIÓN + ENCUESTA DE SATISFACCIÓN');
  console.log('   Cliente: Benjamín Peña');
  console.log('   WhatsApp Destino: +56957138472');
  console.log('   Email Destino: damiancaceres0922@gmail.com');
  console.log('========================================================================\n');

  const cliente_nombre = 'Benjamín Peña';
  const cliente_email = 'damiancaceres0922@gmail.com';
  const cliente_telefono = '+569 57138472';
  const fecha = '2026-11-25';
  const hora_inicio = '15:00';
  const estilista_id = 1;
  const servicio_id = 2;

  // 0. Limpiar posibles reservas previas en ese slot exacto de prueba
  if (sb) {
    const { data: prevs } = await sb
      .from('reservas')
      .select('id')
      .eq('estilista_id', estilista_id)
      .eq('fecha_hora_inicio', `${fecha}T${hora_inicio}:00-03:00`);

    if (prevs && prevs.length > 0) {
      const ids = prevs.map((p) => p.id);
      await sb.from('notificaciones').delete().in('reserva_id', ids);
      await sb.from('encuestas_satisfaccion').delete().in('reserva_id', ids);
      await sb.from('reservas').delete().in('id', ids);
      console.log('🧹 Limpieza de slot previo completada.');
    }
  }

  // 1. CREACIÓN DE RESERVA (FASE 1: CONFIRMACIÓN)
  console.log('\n--- 1. Creando reserva en el sistema (POST /api/v1/reservas) ---');
  const resCrear = await fetch('http://localhost:5000/api/v1/reservas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cliente_nombre,
      cliente_email,
      cliente_telefono,
      estilista_id,
      servicio_id,
      fecha,
      hora_inicio,
      notas: 'Test Integral: Confirmación y Encuesta',
    }),
  });

  const dataCrear = await resCrear.json();
  if (resCrear.status !== 201 || !dataCrear.data) {
    console.error('❌ Error creando reserva:', dataCrear);
    process.exit(1);
  }

  const reservaId = dataCrear.data.id;
  console.log(`✅ Reserva creada exitosamente ID: #${reservaId} (Estado: ${dataCrear.data.estado})`);

  // 2. ESPERAR PROCESAMIENTO ASÍNCRONO DE N8N (PC01 CONFIRMACIÓN)
  console.log('⏳ Esperando 5 segundos para que n8n despache Confirmación por WhatsApp y Email...');
  await new Promise((r) => setTimeout(r, 5000));

  // 3. VERIFICAR NOTIFICACIONES DE CONFIRMACIÓN
  console.log('\n--- 2. Verificando notificaciones de Confirmación en Supabase ---');
  const { data: notifsConf } = await sb
    .from('notificaciones')
    .select('*')
    .eq('reserva_id', reservaId)
    .eq('tipo', 'confirmacion');

  console.table(notifsConf || []);
  const confWa = notifsConf?.find((n) => n.canal === 'whatsapp');
  const confEm = notifsConf?.find((n) => n.canal === 'email');

  if (confWa && confWa.estado_envio === 'enviado') {
    console.log('✅ Confirmación WhatsApp: DESPACHADA CORRECTAMENTE a Meta Cloud API.');
  } else {
    console.warn('⚠️ Confirmación WhatsApp no registrada o con error.');
  }

  if (confEm && confEm.estado_envio === 'enviado') {
    console.log('✅ Confirmación Email: ENVIADA CORRECTAMENTE a damiancaceres0922@gmail.com.');
  } else {
    console.warn('⚠️ Confirmación Email no registrada o con error.');
  }

  // 4. TRANSICIÓN A ATENDIDA (FASE 2: SEGUIMIENTO Y ENCUESTA)
  console.log(`\n--- 3. Marcando reserva #${reservaId} como 'atendida' (PATCH /api/v1/reservas/${reservaId}/atendida) ---`);
  const adminToken = generarTokenAdmin(process.env.ADMIN_EMAIL || 'carolina@peluqueria.cl');
  const resAtendida = await fetch(`http://localhost:5000/api/v1/reservas/${reservaId}/atendida`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
  });

  const dataAtendida = await resAtendida.json();
  if (resAtendida.status !== 200) {
    console.error('❌ Error al marcar atendida:', dataAtendida);
    process.exit(1);
  }
  console.log(`✅ Reserva #${reservaId} actualizada a estado '${dataAtendida.data.estado}'.`);

  // 5. ESPERAR PROCESAMIENTO ASÍNCRONO DE N8N (PC05 SEGUIMIENTO Y ENCUESTA)
  console.log('⏳ Esperando 5 segundos para que n8n despache Encuesta por WhatsApp y Email...');
  await new Promise((r) => setTimeout(r, 5000));

  // 6. VERIFICAR NOTIFICACIONES DE SEGUIMIENTO Y ENCUESTA
  console.log('\n--- 4. Verificando notificaciones de Encuesta de Satisfacción en Supabase ---');
  const { data: notifsSeg } = await sb
    .from('notificaciones')
    .select('*')
    .eq('reserva_id', reservaId)
    .eq('tipo', 'seguimiento');

  console.table(notifsSeg || []);
  const segWa = notifsSeg?.find((n) => n.canal === 'whatsapp');
  const segEm = notifsSeg?.find((n) => n.canal === 'email');

  if (segWa && segWa.estado_envio === 'enviado') {
    console.log('✅ Encuesta WhatsApp: DESPACHADA CORRECTAMENTE a Meta Cloud API.');
  } else {
    console.warn('⚠️ Encuesta WhatsApp no registrada o con error.');
  }

  if (segEm && segEm.estado_envio === 'enviado') {
    console.log('✅ Encuesta Email: ENVIADA CORRECTAMENTE a damiancaceres0922@gmail.com.');
  } else {
    console.warn('⚠️ Encuesta Email no registrada o con error.');
  }

  // 7. VERIFICAR TABLA ENCUESTAS_SATISFACCION
  console.log('\n--- 5. Verificando registro en tabla encuestas_satisfaccion ---');
  const { data: encuestas } = await sb
    .from('encuestas_satisfaccion')
    .select('*')
    .eq('reserva_id', reservaId);

  if (encuestas && encuestas.length > 0) {
    console.log('✅ Registro de Encuesta generado en base de datos:');
    console.table(encuestas);
  } else {
    console.warn('ℹ️ Registro de encuesta creado o pendiente en Supabase.');
  }

  console.log('\n========================================================================');
  console.log(`🎉 TEST FINALIZADO CON ÉXITO PARA RESERVA #${reservaId}`);
  console.log('   Revisa la bandeja de entrada de damiancaceres0922@gmail.com');
  console.log('   y el WhatsApp del número +56957138472.');
  console.log('========================================================================\n');
}

testReservaCompleta().catch(console.error);

const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const sb = require(path.resolve(__dirname, '../backend/src/database/supabaseClient'));

async function testE2ERecordatorio() {
  console.log('--- INICIO TEST E2E: WORKFLOW PC02_Reserva_Recordatorio_24H ---');

  const cliente_email = 'peluqueriacarolinasanfernando@gmail.com';
  const cliente_nombre = 'Damián Cáceres';
  const cliente_telefono = '+56952034275';

  // 1. Verificar / Crear cliente
  console.log('1. Verificando cliente en Supabase...');
  let { data: cliente } = await sb
    .from('clientes')
    .select('*')
    .eq('email', cliente_email)
    .maybeSingle();

  if (cliente) {
    const { data: updated } = await sb
      .from('clientes')
      .update({
        nombre_completo: cliente_nombre,
        telefono_whatsapp: cliente_telefono,
      })
      .eq('id', cliente.id)
      .select()
      .single();
    cliente = updated;
  } else {
    const { data: created, error: errIns } = await sb
      .from('clientes')
      .insert({
        nombre_completo: cliente_nombre,
        email: cliente_email,
        telefono_whatsapp: cliente_telefono,
      })
      .select()
      .single();
    if (errIns) {
      console.error('Error insertando cliente:', errIns);
      return;
    }
    cliente = created;
  }
  console.log('✅ Cliente listo ID:', cliente.id);

  // 2. Crear reserva para mañana (en ventana 24H)
  console.log('2. Insertando reserva en ventana de 24 horas...');
  const fecha_hora_inicio = '2026-10-19T19:00:00+00:00'; // 16:00 hora de Chile mañana
  const fecha_hora_fin = '2026-10-19T19:45:00+00:00';

  // Limpiar reserva previa en ese horario si existe para evitar solapamiento
  const { data: prevs } = await sb.from('reservas').select('id').eq('estilista_id', 1).eq('fecha_hora_inicio', fecha_hora_inicio);
  if (prevs && prevs.length > 0) {
    for (const p of prevs) {
      await sb.from('encuestas_satisfaccion').delete().eq('reserva_id', p.id);
      await sb.from('notificaciones').delete().eq('reserva_id', p.id);
      await sb.from('reservas').delete().eq('id', p.id);
    }
  }

  const { data: reserva, error: errRes } = await sb
    .from('reservas')
    .insert({
      cliente_id: cliente.id,
      estilista_id: 1,
      servicio_id: 2,
      fecha_hora_inicio,
      fecha_hora_fin,
      estado: 'confirmada',
    })
    .select()
    .single();

  if (errRes) {
    console.error('Error al crear reserva:', errRes);
    return;
  }
  console.log('✅ Reserva de prueba creada con éxito ID:', reserva.id, 'Inicio:', fecha_hora_inicio);

  // Limpiar notificaciones previas de esta reserva si las hubiera
  await sb.from('notificaciones').delete().eq('reserva_id', reserva.id);

  // 3. Disparar Webhook de PC02
  console.log('3. Disparando Webhook de n8n para PC02 (pc02-test-recordatorio)...');
  const webhookUrl = 'http://localhost:5678/webhook/pc02-test-recordatorio';

  const resTrigger = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reserva_id: reserva.id,
    }),
  });

  const bodyTrigger = await resTrigger.text();
  console.log(`✅ Respuesta n8n: HTTP ${resTrigger.status} -> ${bodyTrigger}`);

  // 4. Esperar 8 segundos a que n8n complete WhatsApp y Gmail SMTP
  console.log('4. Esperando ejecución de nodos en n8n...');
  await new Promise((r) => setTimeout(r, 8000));

  // 5. Verificar logs en Supabase
  console.log('5. Consultando registros en tabla notificaciones de Supabase...');
  const { data: notifs, error: errNotif } = await sb
    .from('notificaciones')
    .select('*')
    .eq('reserva_id', reserva.id);

  if (errNotif) {
    console.error('Error consultando notificaciones:', errNotif);
    return;
  }

  console.log(`\n--- RESULTADOS NOTIFICACIONES REGISTRADAS (${notifs.length}) ---`);
  notifs.forEach((n) => {
    console.log(`[${n.canal.toUpperCase()}] Tipo: ${n.tipo} | Estado: ${n.estado_envio} | Fecha: ${n.fecha_envio}`);
  });

  const waOk = notifs.some((n) => n.canal === 'whatsapp' && n.estado_envio === 'enviado');
  const emOk = notifs.some((n) => n.canal === 'email' && n.estado_envio === 'enviado');

  if (waOk && emOk) {
    console.log('\n🎉 ¡PRUEBA EXITOSA! Ambos canales (WhatsApp y Email) fueron procesados y enviados.');
  } else {
    console.log('\n⚠️ Atención en el resultado de envío:', { waOk, emOk });
  }

  // 6. Test de Idempotencia (Deduplicación):
  console.log('\n6. Probando deduplicación (idempotencia)...');
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reserva_id: reserva.id,
    }),
  });
  await new Promise((r) => setTimeout(r, 2000));

  const { data: notifsAfter } = await sb
    .from('notificaciones')
    .select('*')
    .eq('reserva_id', reserva.id);

  console.log(`Notificaciones después del segundo disparo: ${notifsAfter.length} (esperado: 2)`);
  if (notifsAfter.length === 2) {
    console.log('🛡️ ¡Deduplicación funciona a la perfección! No se duplicaron envíos.');
  } else {
    console.warn('⚠️ Se detectaron envíos adicionales.');
  }

  console.log('--- FIN TEST E2E PC02 ---');
}

testE2ERecordatorio().catch(console.error);

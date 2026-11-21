const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const sb = require(path.resolve(__dirname, '../backend/src/database/supabaseClient'));

async function testE2EReprogramacion() {
  console.log('--- INICIO TEST E2E: WORKFLOW PC04_Reserva_Reprogramacion ---');

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

  // 2. Crear reserva reprogramada de prueba
  console.log('2. Insertando reserva con nuevo horario en Supabase...');
  const randomDay = String(Math.floor(Math.random() * 20) + 1).padStart(2, '0');
  const randomHour = String(Math.floor(Math.random() * 6) + 10).padStart(2, '0');
  const fecha_hora_inicio = `2026-12-${randomDay}T${randomHour}:00:00+00:00`;
  const fecha_hora_fin = `2026-12-${randomDay}T${randomHour}:45:00+00:00`;

  // Limpiar reserva previa en ese horario si existe
  const { data: prevs } = await sb.from('reservas').select('id').eq('estilista_id', 1).eq('fecha_hora_inicio', fecha_hora_inicio);
  if (prevs && prevs.length > 0) {
    const ids = prevs.map((p) => p.id);
    await sb.from('encuestas_satisfaccion').delete().in('reserva_id', ids);
    await sb.from('notificaciones').delete().in('reserva_id', ids);
    await sb.from('reservas').delete().in('id', ids);
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
    console.error('Error al crear reserva para reprogramación:', errRes);
    return;
  }
  console.log('✅ Reserva creada con éxito ID:', reserva.id, 'Nueva fecha:', fecha_hora_inicio);

  // Limpiar notificaciones previas de esta reserva si las hubiera
  await sb.from('notificaciones').delete().eq('reserva_id', reserva.id);

  // 3. Disparar Webhook de PC04
  console.log('3. Disparando Webhook n8n pc04-reserva-reprogramacion...');
  const webhookUrl = 'http://localhost:5678/webhook/pc04-reserva-reprogramacion';

  const resTrigger = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evento: 'reserva_reprogramada',
      reserva_id: String(reserva.id),
    }),
  });

  const bodyTrigger = await resTrigger.json();
  console.log(`✅ Respuesta n8n: HTTP ${resTrigger.status} ->`, bodyTrigger);

  // 4. Esperar 4 segundos a que se asienten los registros en Supabase
  console.log('4. Esperando confirmación de escritura en base de datos...');
  await new Promise((r) => setTimeout(r, 4000));

  // 5. Verificar logs en tabla notificaciones de Supabase
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
    console.log('\n🎉 ¡PRUEBA EXITOSA! Notificaciones de reprogramación enviadas por WhatsApp y Email.');
  } else {
    console.log('\n⚠️ Atención en el resultado de envío:', { waOk, emOk });
  }

  // 6. Test de Idempotencia (Deduplicación):
  console.log('\n6. Probando deduplicación (idempotencia)...');
  const resDup = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evento: 'reserva_reprogramada',
      reserva_id: String(reserva.id),
    }),
  });
  const bodyDup = await resDup.json();
  console.log(`Respuesta segundo disparo: HTTP ${resDup.status} ->`, bodyDup);

  await new Promise((r) => setTimeout(r, 2000));

  const { data: notifsAfter } = await sb
    .from('notificaciones')
    .select('*')
    .eq('reserva_id', reserva.id);

  console.log(`Notificaciones después del segundo disparo: ${notifsAfter.length} (esperado: 2)`);
  if (notifsAfter.length === 2) {
    console.log('🛡️ ¡Deduplicación funciona a la perfección! No se duplicaron envíos de reprogramación.');
  } else {
    console.warn('⚠️ Se detectaron envíos adicionales no deseados.');
  }

  // 7. Test de Casos de Borde (Robustez de API):
  console.log('\n7. Probando validaciones de casos de borde...');
  
  // 7.1 Payload inválido
  const resBadPayload = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento: 'evento_invalido', reserva_id: '123' }),
  });
  console.log(`Test Evento Inválido (esperado 400): HTTP ${resBadPayload.status}`);

  // 7.2 Reserva no encontrada
  const resNotFound = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento: 'reserva_reprogramada', reserva_id: '9999999' }),
  });
  console.log(`Test Reserva No Encontrada (esperado 404): HTTP ${resNotFound.status}`);

  console.log('--- FIN TEST E2E PC04 ---');
}

testE2EReprogramacion().catch(console.error);

const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const sb = require(path.resolve(__dirname, '../backend/src/database/supabaseClient'));

async function testE2E() {
  console.log('--- INICIO TEST E2E: CREACIÓN DE RESERVA + AUTOMATIZACIÓN N8N ---');

  const randomDay = String(Math.floor(Math.random() * 20) + 10);
  const fecha = `2026-11-${randomDay}`;
  const hora_inicio = '10:00';
  const hora_fin = '10:45';
  const cliente_email = 'peluqueriacarolinasanfernando@gmail.com';
  const cliente_nombre = 'Damián Cáceres';
  const cliente_telefono = '+56952034275';

  // 1. Guardar cliente en Supabase
  console.log('1. Registrando / Actualizando cliente en Supabase...');
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

  // 2. Insertar reserva en Supabase
  console.log('2. Insertando reserva en Supabase...');
  const fecha_hora_inicio = `${fecha}T${hora_inicio}:00-03:00`;
  const fecha_hora_fin = `${fecha}T${hora_fin}:00-03:00`;

  // Limpiar reserva previa en ese horario de prueba
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
      estado: 'pendiente',
    })
    .select()
    .single();

  if (errRes) {
    console.error('Error al crear reserva:', errRes);
    return;
  }
  console.log('✅ Reserva creada ID:', reserva.id);

  // 3. Disparar Webhook de n8n
  console.log('3. Disparando Webhook n8n pc01-reserva-confirmacion...');
  const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/pc01-reserva-confirmacion';
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evento: 'reserva_creada',
      reserva_id: String(reserva.id),
    }),
  });

  const responseText = await response.text();
  console.log(`✅ Respuesta n8n: HTTP ${response.status} -> ${responseText}`);

  // 4. Esperar 2 segundos para que n8n complete las escrituras asíncronas en Supabase
  await new Promise((r) => setTimeout(r, 2000));

  // 5. Verificar tabla notificaciones en Supabase
  console.log('4. Verificando logs generados en tabla notificaciones de Supabase...');
  const { data: notificaciones, error: errNotif } = await sb
    .from('notificaciones')
    .select('*')
    .eq('reserva_id', reserva.id);

  if (errNotif) {
    console.error('Error consultando notificaciones:', errNotif);
  } else {
    console.log(`✅ Notificaciones registradas para reserva #${reserva.id}:`, notificaciones.length);
    console.table(notificaciones);
  }

  console.log('--- FIN TEST E2E ---');
}

testE2E().catch(console.error);

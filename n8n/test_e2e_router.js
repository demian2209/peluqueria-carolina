const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const sb = require(path.resolve(__dirname, '../backend/src/database/supabaseClient'));

async function testE2ERouter() {
  console.log('--- INICIO TEST E2E: WORKFLOW PC06_Sistema_Webhook_Router ---');

  const cliente_email = 'peluqueriacarolinasanfernando@gmail.com';
  const cliente_nombre = 'Damián Cáceres';
  const cliente_telefono = '+56952034275';
  const routerUrl = 'http://localhost:5678/webhook/pc06-webhook-router';

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

  // 2. Probar Enrutamiento: Evento reserva_creada -> Router -> PC01
  console.log('\n2. Probando enrutamiento: evento reserva_creada (hacia PC01)...');
  const fechaSlot1 = '2026-10-24T15:00:00+00:00';
  await sb.from('reservas').delete().eq('estilista_id', 1).eq('fecha_hora_inicio', fechaSlot1);

  const { data: res1 } = await sb
    .from('reservas')
    .insert({
      cliente_id: cliente.id,
      estilista_id: 1,
      servicio_id: 2,
      fecha_hora_inicio: fechaSlot1,
      fecha_hora_fin: '2026-10-24T15:45:00+00:00',
      estado: 'pendiente',
    })
    .select()
    .single();

  const respRoute1 = await fetch(routerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evento: 'reserva_creada',
      reserva_id: String(res1.id),
    }),
  });

  const raw1 = await respRoute1.text();
  let body1;
  try { body1 = JSON.parse(raw1); } catch (e) { body1 = raw1; }
  console.log(`Respuesta Router para reserva_creada: HTTP ${respRoute1.status} ->`, body1);

  // Esperar procesamiento y verificar en BD
  await new Promise((r) => setTimeout(r, 4000));
  const { data: notifs1 } = await sb.from('notificaciones').select('*').eq('reserva_id', res1.id);
  console.log(`Notificaciones generadas para reserva #${res1.id} (PC01): ${notifs1.length}`);
  const ok1 = notifs1.some((n) => n.tipo === 'confirmacion' && n.estado_envio === 'enviado');
  if (ok1) console.log('✅ PC06 enrutó con éxito hacia PC01_Reserva_Confirmacion.');

  // 3. Probar Enrutamiento: Evento reserva_cancelada -> Router -> PC03
  console.log('\n3. Probando enrutamiento: evento reserva_cancelada (hacia PC03)...');
  const fechaSlot2 = '2026-10-24T16:00:00+00:00';
  await sb.from('reservas').delete().eq('estilista_id', 1).eq('fecha_hora_inicio', fechaSlot2);

  const { data: res2 } = await sb
    .from('reservas')
    .insert({
      cliente_id: cliente.id,
      estilista_id: 1,
      servicio_id: 2,
      fecha_hora_inicio: fechaSlot2,
      fecha_hora_fin: '2026-10-24T16:45:00+00:00',
      estado: 'cancelada',
    })
    .select()
    .single();

  const respRoute2 = await fetch(routerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evento: 'reserva_cancelada',
      reserva_id: String(res2.id),
    }),
  });

  const raw2 = await respRoute2.text();
  let body2;
  try { body2 = JSON.parse(raw2); } catch (e) { body2 = raw2; }
  console.log(`Respuesta Router para reserva_cancelada: HTTP ${respRoute2.status} ->`, body2);

  await new Promise((r) => setTimeout(r, 4000));
  const { data: notifs2 } = await sb.from('notificaciones').select('*').eq('reserva_id', res2.id);
  console.log(`Notificaciones generadas para reserva #${res2.id} (PC03): ${notifs2.length}`);
  const ok2 = notifs2.some((n) => n.tipo === 'cancelacion' && n.estado_envio === 'enviado');
  if (ok2) console.log('✅ PC06 enrutó con éxito hacia PC03_Reserva_Cancelacion.');

  // 4. Probar Casos de Error y Fallback del Router
  console.log('\n4. Probando validaciones y fallbacks del Router...');

  // 4.1. Evento desconocido (Fallback Switch -> 400)
  const respUnknown = await fetch(routerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evento: 'evento_inexistente',
      reserva_id: '123',
    }),
  });
  const bodyUnknown = await respUnknown.json();
  console.log(`Test Evento Desconocido (esperado 400): HTTP ${respUnknown.status} ->`, bodyUnknown);

  // 4.2. Payload Inválido (sin evento o con caracteres inválidos -> 400)
  const respInvalid = await fetch(routerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evento: '123_INVALID!',
    }),
  });
  const bodyInvalid = await respInvalid.json();
  console.log(`Test Payload Inválido (esperado 400): HTTP ${respInvalid.status} ->`, bodyInvalid);

  console.log('\n--- FIN TEST E2E PC06 ---');
}

testE2ERouter().catch(console.error);

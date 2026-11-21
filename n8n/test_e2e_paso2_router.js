const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const sb = require(path.resolve(__dirname, '../backend/src/database/supabaseClient'));

const ROUTER_URL = 'http://localhost:5678/webhook/pc06-webhook-router';

async function testPaso2Router() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: PASO 2 - PC06 ROUTER & NOMENCLATURA DUAL');
  console.log('================================================================\n');

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

  // Helper para insertar reserva de prueba
  async function crearReservaPrueba(fechaHora, estado = 'pendiente') {
    // Limpiar previa
    const { data: prevs } = await sb.from('reservas').select('id').eq('estilista_id', 1).eq('fecha_hora_inicio', fechaHora);
    if (prevs && prevs.length > 0) {
      const prevIds = prevs.map((p) => p.id);
      await sb.from('notificaciones').delete().in('reserva_id', prevIds);
      await sb.from('reservas').delete().in('id', prevIds);
    }

    const { data: res, error } = await sb.from('reservas').insert({
      cliente_id: cliente.id,
      estilista_id: 1,
      servicio_id: 2,
      fecha_hora_inicio: fechaHora,
      fecha_hora_fin: new Date(new Date(fechaHora).getTime() + 45 * 60000).toISOString(),
      estado,
    }).select().single();

    if (error) throw new Error(`Error creando reserva de prueba: ${error.message}`);
    return res;
  }

  // Helper para limpiar reserva
  async function limpiarReserva(id) {
    if (!id) return;
    await sb.from('notificaciones').delete().eq('reserva_id', id);
    await sb.from('reservas').delete().eq('id', id);
  }

  let r1, r2, r3, r4, r5;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Nomenclatura Dual - booking.created -> PC06 -> PC01
    // -----------------------------------------------------------------
    console.log('\n--- 1. Test booking.created (con booking_id) -> PC06 -> PC01 ---');
    r1 = await crearReservaPrueba('2026-11-21T10:00:00Z', 'pendiente');

    const res1 = await fetch(ROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'booking.created',
        booking_id: String(r1.id),
      }),
    });
    const body1 = await res1.json();
    console.log(`Router respuesta HTTP ${res1.status}:`, body1);
    if (res1.status !== 200 || !body1.success) {
      throw new Error(`Falló test booking.created: ${JSON.stringify(body1)}`);
    }

    // Verificar en Supabase la notificación
    await new Promise((r) => setTimeout(r, 3500));
    const { data: notifs1 } = await sb.from('notificaciones').select('*').eq('reserva_id', r1.id);
    const ok1 = notifs1.some((n) => n.tipo === 'confirmacion' && n.estado_envio === 'enviado');
    if (!ok1) throw new Error('No se registró la notificación enviada de confirmación en Supabase');
    console.log(`✅ TEST 1 APROBADO: booking.created enrutado a PC01 y notificación registrada (${notifs1.length} notif)`);

    // -----------------------------------------------------------------
    // TEST 2: Nomenclatura Dual - booking.cancelled -> PC06 -> PC03
    // -----------------------------------------------------------------
    console.log('\n--- 2. Test booking.cancelled (con booking_id) -> PC06 -> PC03 ---');
    r2 = await crearReservaPrueba('2026-11-21T11:00:00Z', 'cancelada');

    const res2 = await fetch(ROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'booking.cancelled',
        booking_id: String(r2.id),
      }),
    });
    const body2 = await res2.json();
    console.log(`Router respuesta HTTP ${res2.status}:`, body2);
    if (res2.status !== 200 || !body2.success) {
      throw new Error(`Falló test booking.cancelled: ${JSON.stringify(body2)}`);
    }

    await new Promise((r) => setTimeout(r, 3500));
    const { data: notifs2 } = await sb.from('notificaciones').select('*').eq('reserva_id', r2.id);
    const ok2 = notifs2.some((n) => n.tipo === 'cancelacion' && n.estado_envio === 'enviado');
    if (!ok2) throw new Error('No se registró la notificación enviada de cancelación en Supabase');
    console.log(`✅ TEST 2 APROBADO: booking.cancelled enrutado a PC03 y notificación registrada (${notifs2.length} notif)`);

    // -----------------------------------------------------------------
    // TEST 3: Nomenclatura Dual - booking.completed -> PC06 -> PC05
    // -----------------------------------------------------------------
    console.log('\n--- 3. Test booking.completed (con booking_id) -> PC06 -> PC05 ---');
    r3 = await crearReservaPrueba('2026-11-21T12:00:00Z', 'atendida');

    const res3 = await fetch(ROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'booking.completed',
        booking_id: String(r3.id),
      }),
    });
    const body3 = await res3.json();
    console.log(`Router respuesta HTTP ${res3.status}:`, body3);
    if (res3.status !== 200 || !body3.success) {
      throw new Error(`Falló test booking.completed: ${JSON.stringify(body3)}`);
    }

    await new Promise((r) => setTimeout(r, 3500));
    const { data: notifs3 } = await sb.from('notificaciones').select('*').eq('reserva_id', r3.id);
    const ok3 = notifs3.some((n) => n.tipo === 'seguimiento' && n.estado_envio === 'enviado');
    if (!ok3) throw new Error('No se registró la notificación enviada de seguimiento en Supabase');
    console.log(`✅ TEST 3 APROBADO: booking.completed enrutado a PC05 y encuesta despachada (${notifs3.length} notif)`);

    // -----------------------------------------------------------------
    // TEST 4: Nomenclatura Dual - chat.message -> PC06 -> PC07 (Gemini)
    // -----------------------------------------------------------------
    console.log('\n--- 4. Test chat.message -> PC06 -> PC07 (Gemini AI) ---');
    const res4 = await fetch(ROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'chat.message',
        mensaje: '¿Cuáles son los precios de Balayage y Corte Mujer?',
      }),
    });
    const body4 = await res4.json();
    console.log(`Router respuesta HTTP ${res4.status}:`, body4);
    if (res4.status !== 200 || !body4.success || !body4.respuesta) {
      throw new Error(`Falló test chat.message hacia Gemini: ${JSON.stringify(body4)}`);
    }
    console.log(`Respuesta IA generada (${body4.respuesta.length} chars): "${body4.respuesta.substring(0, 80)}..."`);
    console.log('✅ TEST 4 APROBADO: chat.message enrutado a PC07 y respuesta generada por Gemini');

    // -----------------------------------------------------------------
    // TEST 5: Nomenclatura Dual - survey.submitted -> PC06 -> PC08 (Encuesta)
    // -----------------------------------------------------------------
    console.log('\n--- 5. Test survey.submitted -> PC06 -> PC08 (Encuestas) ---');
    r4 = await crearReservaPrueba('2026-11-21T14:00:00Z', 'atendida');

    const res5 = await fetch(ROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'survey.submitted',
        booking_id: String(r4.id),
        puntaje: 5,
        comentario: 'Excelente atención y servicio profesional',
      }),
    });
    const body5 = await res5.json();
    console.log(`Router respuesta HTTP ${res5.status}:`, body5);
    if (res5.status !== 200 || !body5.success) {
      throw new Error(`Falló test survey.submitted hacia PC08: ${JSON.stringify(body5)}`);
    }

    // Verificar en Supabase
    const { data: enc } = await sb.from('encuestas_satisfaccion').select('*').eq('reserva_id', r4.id);
    if (!enc || enc.length === 0 || enc[0].puntaje !== 5) {
      throw new Error('No se persistió la encuesta de satisfacción con puntaje 5 en Supabase');
    }
    console.log(`✅ TEST 5 APROBADO: survey.submitted persistido con ID #${enc[0].id} (Puntaje: ${enc[0].puntaje})`);

    // -----------------------------------------------------------------
    // TEST 6: Robustez y Manejo de Errores
    // -----------------------------------------------------------------
    console.log('\n--- 6. Casos Borde y Rechazos de Seguridad en PC06 ---');

    // 6.1 Evento Desconocido (debe retornar 400 y mensaje controlado)
    const resUnknown = await fetch(ROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'unknown.custom.event',
        reserva_id: '123',
      }),
    });
    const bodyUnknown = await resUnknown.json();
    console.log('6.1 Evento desconocido HTTP:', resUnknown.status, bodyUnknown);
    if (resUnknown.status !== 400 || bodyUnknown.success !== false) {
      throw new Error(`Falló 6.1: Se esperaba HTTP 400, recibido ${resUnknown.status}`);
    }

    // 6.2 Regex rechaza caracteres maliciosos o no permitidos
    const resBadChars = await fetch(ROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: '<script>alert(1)</script>',
      }),
    });
    const bodyBadChars = await resBadChars.json();
    console.log('6.2 Caracteres inválidos HTTP:', resBadChars.status, bodyBadChars);
    if (resBadChars.status !== 400 || bodyBadChars.success !== false) {
      throw new Error(`Falló 6.2: Se esperaba HTTP 400, recibido ${resBadChars.status}`);
    }

    console.log('✅ TEST 6 APROBADO: Rechazos controlados y protección de inyección validados');

    console.log('\n🎉 ================================================================');
    console.log('🏆 PASO 2 COMPLETADO AL 100%: PC06 ROUTER & DUAL NAMING EXITOSO');
    console.log('================================================================');
  } finally {
    // Limpieza
    await limpiarReserva(r1?.id);
    await limpiarReserva(r2?.id);
    await sb.from('encuestas_satisfaccion').delete().eq('reserva_id', r3?.id);
    await limpiarReserva(r3?.id);
    await sb.from('encuestas_satisfaccion').delete().eq('reserva_id', r4?.id);
    await limpiarReserva(r4?.id);
    console.log('🧹 Limpieza de datos de prueba en Supabase completada.');
  }
}

testPaso2Router().catch((err) => {
  console.error('\n❌ ERROR EN TEST SUITE PASO 2:', err);
  process.exit(1);
});

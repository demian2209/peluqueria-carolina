require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');
const app = require('./src/app');
const sb = require('./src/database/supabaseClient');
const { generarTokenAdmin } = require('./src/utils/reservaToken.utils');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO TEST SUITE: PASO 1 - BACKEND RESERVAS');
  console.log('====================================================\n');

  const adminToken = generarTokenAdmin(process.env.ADMIN_EMAIL || 'carolina@peluqueria.cl');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  // Iniciar servidor en puerto efímero
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1/reservas`;
  console.log(`📡 Servidor de pruebas Express levantado en ${baseUrl}`);

  let testReservaId = null;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Crear Reserva
    // -----------------------------------------------------------------
    console.log('\n--- Test 1: POST /api/v1/reservas (Creación de Reserva) ---');
    const futureDate = '2026-11-20';
    const futureTime = '11:00';

    const createPayload = {
      cliente_nombre: 'Test Automation QA',
      cliente_email: 'qa.automation.test@peluqueria.cl',
      cliente_telefono: '+56912345678',
      estilista_id: 1,
      servicio_id: 2,
      fecha: futureDate,
      hora_inicio: futureTime,
      notas: 'Prueba unitaria automatizada Paso 1',
    };

    // Limpiar reservas previas en ese slot si hubiese
    if (sb) {
      const { data: testClients } = await sb
        .from('clientes')
        .select('id')
        .eq('email', createPayload.cliente_email);
      if (testClients && testClients.length > 0) {
        for (const c of testClients) {
          const { data: revs } = await sb.from('reservas').select('id').eq('cliente_id', c.id);
          if (revs && revs.length > 0) {
            const revIds = revs.map((r) => r.id);
            await sb.from('encuestas_satisfaccion').delete().in('reserva_id', revIds);
            await sb.from('notificaciones').delete().in('reserva_id', revIds);
            await sb.from('reservas').delete().in('id', revIds);
          }
        }
      }
    }

    const resCreate = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload),
    });

    const dataCreate = await resCreate.json();
    console.log(`Status HTTP: ${resCreate.status}`, dataCreate.status);
    if (resCreate.status !== 201) {
      throw new Error(`Falló Test 1: Esperado 201, recibido ${resCreate.status}: ${JSON.stringify(dataCreate)}`);
    }
    testReservaId = dataCreate.data.id;
    console.log(`✅ Test 1 APROBADO: Reserva creada con ID #${testReservaId}`);

    // -----------------------------------------------------------------
    // TEST 2: Reprogramar Reserva
    // -----------------------------------------------------------------
    console.log('\n--- Test 2: PATCH /api/v1/reservas/:id/reprogramar (Reprogramación) ---');
    const newDate = '2026-11-20';
    const newTime = '15:00';

    const resReprog = await fetch(`${baseUrl}/${testReservaId}/reprogramar`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-reserva-token': dataCreate.data.gestion_token || '',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fecha: newDate,
        hora_inicio: newTime,
        notas: 'Reprogramada vía test de verificación',
      }),
    });

    const dataReprog = await resReprog.json();
    console.log(`Status HTTP: ${resReprog.status}`, dataReprog.status);
    if (resReprog.status !== 200) {
      throw new Error(`Falló Test 2: Esperado 200, recibido ${resReprog.status}: ${JSON.stringify(dataReprog)}`);
    }
    console.log('Data reprogramada:', {
      id: dataReprog.data.id,
      inicio: dataReprog.data.fecha_hora_inicio || dataReprog.data.hora_inicio,
      fin: dataReprog.data.fecha_hora_fin || dataReprog.data.hora_fin,
      estado: dataReprog.data.estado,
    });
    console.log('✅ Test 2 APROBADO: Reserva reprogramada exitosamente');

    // Esperar a que el webhook asíncrono de n8n para reprogramación complete
    await new Promise((r) => setTimeout(r, 2000));

    // -----------------------------------------------------------------
    // TEST 3: Marcar Atendida
    // -----------------------------------------------------------------
    console.log('\n--- Test 3: PATCH /api/v1/reservas/:id/atendida (Cierre de Cita) ---');
    const resAtendida = await fetch(`${baseUrl}/${testReservaId}/atendida`, {
      method: 'PATCH',
      headers: authHeaders,
    });

    const dataAtendida = await resAtendida.json();
    console.log(`Status HTTP: ${resAtendida.status}`, dataAtendida.status);
    if (resAtendida.status !== 200 || dataAtendida.data.estado !== 'atendida') {
      throw new Error(`Falló Test 3: Esperado 200 y estado atendida, recibido ${resAtendida.status}: ${JSON.stringify(dataAtendida)}`);
    }
    console.log(`✅ Test 3 APROBADO: Reserva #${testReservaId} marcada como atendida`);

    // -----------------------------------------------------------------
    // TEST 4: Cancelar Reserva (Validar ventana 12h y éxito)
    // -----------------------------------------------------------------
    console.log('\n--- Test 4: PATCH /api/v1/reservas/:id/cancelar (Cancelación) ---');
    // Creamos una segunda reserva a cancelar
    const resCreate2 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createPayload,
        hora_inicio: '16:00',
      }),
    });
    const dataCreate2 = await resCreate2.json();
    const idToCancel = dataCreate2.data.id;

    const resCancel = await fetch(`${baseUrl}/${idToCancel}/cancelar`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-reserva-token': dataCreate2.data.gestion_token || '',
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const dataCancel = await resCancel.json();
    console.log(`Status HTTP: ${resCancel.status}`, dataCancel.status);
    if (resCancel.status !== 200 || dataCancel.data.estado !== 'cancelada') {
      throw new Error(`Falló Test 4: Esperado 200 y estado cancelada, recibido ${resCancel.status}: ${JSON.stringify(dataCancel)}`);
    }
    console.log(`✅ Test 4 APROBADO: Reserva #${idToCancel} cancelada correctamente`);

    // -----------------------------------------------------------------
    // TEST 5: Validaciones de Seguridad y Casos Borde
    // -----------------------------------------------------------------
    console.log('\n--- Test 5: Casos Borde y Validaciones ---');

    // 5.1 No se puede reprogramar cita cancelada
    const resReprogCancelada = await fetch(`${baseUrl}/${idToCancel}/reprogramar`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ fecha: '2026-11-21', hora_inicio: '10:00' }),
    });
    console.log('5.1 Intento reprogramar cancelada -> HTTP:', resReprogCancelada.status);
    if (resReprogCancelada.status !== 409) {
      throw new Error(`Falló 5.1: Se esperaba 409, recibido ${resReprogCancelada.status}`);
    }

    // 5.2 No se puede marcar como atendida una cita cancelada
    const resAtendidaCancelada = await fetch(`${baseUrl}/${idToCancel}/atendida`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    console.log('5.2 Intento marcar atendida cancelada -> HTTP:', resAtendidaCancelada.status);
    if (resAtendidaCancelada.status !== 409) {
      throw new Error(`Falló 5.2: Se esperaba 409, recibido ${resAtendidaCancelada.status}`);
    }

    console.log('✅ Test 5 APROBADO: Todos los casos borde y restricciones respondieron adecuadamente');

    // Limpieza de datos de prueba
    if (sb) {
      const ids = [testReservaId, idToCancel].filter(Boolean);
      if (ids.length > 0) {
        await sb.from('encuestas_satisfaccion').delete().in('reserva_id', ids);
        await sb.from('notificaciones').delete().in('reserva_id', ids);
        await sb.from('reservas').delete().in('id', ids);
      }
      console.log('\n🧹 Limpieza de registros de prueba completada en Supabase.');
    }

    console.log('\n🎉 ====================================================');
    console.log('🏆 PASO 1 COMPLETADO AL 100% SIN NINGÚN ERROR');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Error en Test Suite Paso 1:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();

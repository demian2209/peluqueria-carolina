const path = require('path');
const http = require('http');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const sb = require(path.resolve(__dirname, '../backend/src/database/supabaseClient'));

function sendPost(pathUrl, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5678,
        path: pathUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch (e) {
            parsed = body;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.write(data);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function limpiarReservaPorFecha(fecha) {
  const { data: prevs } = await sb.from('reservas').select('id').eq('fecha_hora_inicio', fecha);
  if (prevs && prevs.length > 0) {
    const ids = prevs.map((p) => p.id);
    await sb.from('notificaciones').delete().in('reserva_id', ids);
    await sb.from('encuestas_satisfaccion').delete().in('reserva_id', ids);
    await sb.from('reservas').delete().in('id', ids);
  }
}

async function runE2E() {
  console.log('--- INICIO TEST E2E: PC08_Encuesta_Respuesta ---');

  // 1. Validaciones de Payload Inválido (HTTP 400)
  console.log('\n[Fase 1] Validaciones de payload inválido:');
  let res = await sendPost('/webhook/pc08-encuesta-respuesta', {});
  assert(res.status === 400, 'Payload vacío responde 400');

  res = await sendPost('/webhook/pc08-encuesta-respuesta', { reserva_id: '123', puntaje: 0 });
  assert(res.status === 400, 'Puntaje 0 responde 400');

  res = await sendPost('/webhook/pc08-encuesta-respuesta', { reserva_id: '123', puntaje: 6 });
  assert(res.status === 400, 'Puntaje 6 responde 400');

  res = await sendPost('/webhook/pc08-encuesta-respuesta', { reserva_id: '', puntaje: 5 });
  assert(res.status === 400, 'Reserva vacía responde 400');

  res = await sendPost('/webhook/pc08-encuesta-respuesta', { reserva_id: '123', puntaje: 3.5 });
  assert(res.status === 400, 'Puntaje decimal responde 400');

  // 2. Reserva Inexistente (HTTP 404)
  console.log('\n[Fase 2] Reserva inexistente:');
  res = await sendPost('/webhook/pc08-encuesta-respuesta', { reserva_id: '99999999', puntaje: 5 });
  assert(res.status === 404, 'Reserva no encontrada responde 404');
  assert(res.body.error === 'Reserva no encontrada', 'Mensaje de error correcto');

  // 3. Reserva No Atendida (HTTP 409)
  console.log('\n[Fase 3] Reserva en estado no atendida (pendiente):');
  // Buscar o crear reserva pendiente
  const { data: resvPend } = await sb
    .from('reservas')
    .select('id')
    .eq('estado', 'pendiente')
    .limit(1)
    .single();

  if (resvPend) {
    res = await sendPost('/webhook/pc08-encuesta-respuesta', {
      reserva_id: String(resvPend.id),
      puntaje: 5,
    });
    assert(res.status === 409, 'Reserva no atendida responde 409');
    assert(res.body.error === 'La reserva aún no puede ser evaluada', 'Mensaje de no evaluable correcto');
  }

  // 4. Flujo Exitoso Directo (HTTP 200)
  console.log('\n[Fase 4] Flujo exitoso directo a PC08:');
  const randomDay = String(Math.floor(Math.random() * 20) + 1).padStart(2, '0');
  const testFecha = `2026-12-${randomDay}T11:00:00-03:00`;
  const testFechaFin = `2026-12-${randomDay}T11:45:00-03:00`;

  // Limpiar reserva de prueba si existiera
  await limpiarReservaPorFecha(testFecha);

  const { data: reservaAtendida, error: errCrea } = await sb
    .from('reservas')
    .insert({
      cliente_id: 2,
      servicio_id: 2,
      estilista_id: 1,
      fecha_hora_inicio: testFecha,
      fecha_hora_fin: testFechaFin,
      estado: 'atendida',
    })
    .select()
    .single();

  assert(!errCrea && reservaAtendida, `Reserva de prueba creada ID: ${reservaAtendida?.id}`);

  const comentarioTest = 'La atención de Marc fue impecable. Muy puntual y profesional.';
  res = await sendPost('/webhook/pc08-encuesta-respuesta', {
    reserva_id: String(reservaAtendida.id),
    puntaje: 5,
    comentario: comentarioTest,
  });

  assert(res.status === 200, 'Registro exitoso responde 200');
  assert(res.body.success === true, 'Respuesta indica success: true');

  // Verificar persistencia en Supabase
  const { data: encuestaDB } = await sb
    .from('encuestas_satisfaccion')
    .select('*')
    .eq('reserva_id', reservaAtendida.id)
    .single();

  assert(!!encuestaDB, 'Encuesta encontrada en Supabase encuestas_satisfaccion');
  assert(encuestaDB.puntaje === 5, 'Puntaje persistido correctamente (5)');
  assert(encuestaDB.comentario === comentarioTest, 'Comentario persistido fielmente');

  // 5. Deduplicación / Idempotencia (HTTP 409)
  console.log('\n[Fase 5] Prueba de deduplicación (idempotencia):');
  res = await sendPost('/webhook/pc08-encuesta-respuesta', {
    reserva_id: String(reservaAtendida.id),
    puntaje: 4,
    comentario: 'Segundo intento',
  });

  assert(res.status === 409, 'Encuesta duplicada responde 409');
  assert(res.body.error === 'La encuesta de esta reserva ya fue respondida', 'Mensaje de encuesta duplicada correcto');

  // 6. Flujo a través de Router PC06 (HTTP 200)
  console.log('\n[Fase 6] Flujo a través del Router PC06:');
  const testFecha2 = `2026-12-${randomDay}T12:00:00-03:00`;
  const testFechaFin2 = `2026-12-${randomDay}T12:45:00-03:00`;
  await limpiarReservaPorFecha(testFecha2);

  const { data: reservaRouter } = await sb
    .from('reservas')
    .insert({
      cliente_id: 2,
      servicio_id: 3,
      estilista_id: 1,
      fecha_hora_inicio: testFecha2,
      fecha_hora_fin: testFechaFin2,
      estado: 'atendida',
    })
    .select()
    .single();

  res = await sendPost('/webhook/pc06-webhook-router', {
    evento: 'encuesta_respondida',
    reserva_id: String(reservaRouter.id),
    puntaje: 4,
    comentario: 'Excelente balayage, volveré.',
  });

  assert(res.status === 200, 'Router PC06 responde 200 al despachar a PC08');
  assert(res.body.success === true, 'Router devuelve success: true');

  const { data: encuestaRouterDB } = await sb
    .from('encuestas_satisfaccion')
    .select('*')
    .eq('reserva_id', reservaRouter.id)
    .single();

  assert(!!encuestaRouterDB, 'Encuesta enviada por router registrada en Supabase');
  assert(encuestaRouterDB.puntaje === 4, 'Puntaje de router persistido (4)');

  console.log('\n🎉 TODAS LAS PRUEBAS DE PC08 PASARON EXITOSAMENTE (100% GREEN)');
  console.log('--- FIN TEST E2E PC08 ---');
}

runE2E();

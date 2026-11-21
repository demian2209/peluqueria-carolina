require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('./src/app');
const { generarTokenAdmin } = require('./src/utils/reservaToken.utils');
const { calcularEstadisticasEncuestas } = require('./src/services/encuestas.service');

let passed = 0;
let failed = 0;

async function test(nombre, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${nombre}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${nombre}`);
    console.error(`     → ${err.message}`);
  }
}

async function run() {
  console.log('==============================================================');
  console.log('🧪 QA SUITE: MÓDULO DE ENCUESTAS DE SATISFACCIÓN (ADMIN & API)');
  console.log('==============================================================\n');

  const storePath = path.resolve(__dirname, 'src/database/encuestas_satisfaccion.store');
  const storeExistedBefore = fs.existsSync(storePath);
  const storeBackup = storeExistedBefore ? fs.readFileSync(storePath, 'utf8') : null;

  // ───────────────────────────────────────────────────────────────────────────
  // 1. PRUEBAS UNITARIAS (Cálculo de KPIs y Distribución)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Pruebas Unitarias (Motor de Estadísticas de Encuestas) ---');

  await test('Colección vacía retorna promedio 0, satisfacción 0% y distribución en ceros', () => {
    const stats = calcularEstadisticasEncuestas([]);
    assert.strictEqual(stats.total, 0);
    assert.strictEqual(stats.promedio, 0);
    assert.strictEqual(stats.satisfaccion_positiva_pct, 0);
    assert.strictEqual(stats.con_comentario, 0);
    assert.deepStrictEqual(stats.distribucion, { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  });

  await test('Calcula correctamente promedio, % positivo (4★ y 5★), comentarios y distribución', () => {
    const items = [
      { puntaje: 5, comentario: 'Excelente servicio' },
      { puntaje: 5, comentario: '' },
      { puntaje: 4, comentario: 'Muy buena atención' },
      { puntaje: 2, comentario: 'Demora en la espera' },
    ];
    const stats = calcularEstadisticasEncuestas(items);
    assert.strictEqual(stats.total, 4);
    assert.strictEqual(stats.promedio, 4); // (5+5+4+2)/4 = 4.0
    assert.strictEqual(stats.satisfaccion_positiva_pct, 75); // 3 de 4 >= 4★
    assert.strictEqual(stats.con_comentario, 3);
    assert.deepStrictEqual(stats.distribucion, { 5: 2, 4: 1, 3: 0, 2: 1, 1: 0 });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. PRUEBAS DE INTEGRACIÓN HTTP (Autorización, Flujo Cliente -> Admin, Filtros)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Pruebas de Integración HTTP (/api/v1/encuestas y /api/v1/reservas/:id/encuesta) ---');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const adminToken = generarTokenAdmin(process.env.ADMIN_EMAIL || 'carolina@peluqueria.cl');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  let testReserva = null;

  try {
    await test('Autorización: GET /encuestas sin token retorna 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/encuestas`);
      assert.strictEqual(res.status, 401);
    });

    await test('Autorización: GET /encuestas con token inválido retorna 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/encuestas`, {
        headers: { Authorization: 'Bearer token_falso_123' },
      });
      assert.strictEqual(res.status, 401);
    });

    await test('Autorización: DELETE /encuestas/:id sin token retorna 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/encuestas/enc-seed-1`, {
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 401);
    });

    await test('Crear reserva de prueba y rechazar encuesta mientras está en estado pendiente (409)', async () => {
      const resCreate = await fetch(`${baseUrl}/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nombre: 'Valeria QA Encuesta',
          cliente_email: 'valeria.qa.encuesta@peluqueria.cl',
          cliente_telefono: '+56988776655',
          estilista_id: 'e1-carolina-valenzuela',
          servicio_id: 's4-balayage',
          fecha: '2027-06-15',
          hora_inicio: '09:00',
          notas: 'Reserva para test de encuesta',
        }),
      });
      const jsonCreate = await resCreate.json();
      assert.strictEqual(resCreate.status, 201, `Esperado 201, recibido ${resCreate.status}`);
      testReserva = jsonCreate.data;

      // Intentar evaluar reserva pendiente debe retornar 409
      const resEncPendiente = await fetch(
        `${baseUrl}/reservas/${encodeURIComponent(testReserva.id)}/encuesta`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            puntaje: 5,
            comentario: 'Intento prematuro',
            token: testReserva.gestion_token,
          }),
        }
      );
      assert.strictEqual(resEncPendiente.status, 409);
    });

    await test('Marcar reserva como atendida y validar entradas hostiles en POST /reservas/:id/encuesta (400)', async () => {
      const resAtendida = await fetch(
        `${baseUrl}/reservas/${encodeURIComponent(testReserva.id)}/atendida`,
        {
          method: 'PATCH',
          headers: authHeaders,
        }
      );
      assert.strictEqual(resAtendida.status, 200);

      // Puntaje fuera de rango (0 y 6)
      for (const puntajeInvalido of [0, 6, -1, 3.5, 'cinco']) {
        const resBad = await fetch(
          `${baseUrl}/reservas/${encodeURIComponent(testReserva.id)}/encuesta`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              puntaje: puntajeInvalido,
              comentario: 'Puntaje inválido',
              token: testReserva.gestion_token,
            }),
          }
        );
        assert.strictEqual(
          resBad.status,
          400,
          `Puntaje inválido '${puntajeInvalido}' debía responder 400, respondió ${resBad.status}`
        );
      }
    });

    await test('POST /reservas/:id/encuesta registra calificación válida y bloquea duplicados (409)', async () => {
      const resOk = await fetch(
        `${baseUrl}/reservas/${encodeURIComponent(testReserva.id)}/encuesta`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            puntaje: 5,
            comentario: 'Fascinada con el resultado del balayage QA, atención impecable.',
            token: testReserva.gestion_token,
          }),
        }
      );
      const jsonOk = await resOk.json();
      assert.strictEqual(resOk.status, 200, `Esperado 200, recibido ${resOk.status}: ${jsonOk.message}`);
      assert.strictEqual(jsonOk.status, 'success');
      assert.strictEqual(jsonOk.data.puntaje, 5);

      // Segundo envío para la misma reserva debe ser rechazado con 409 (Idempotencia)
      const resDup = await fetch(
        `${baseUrl}/reservas/${encodeURIComponent(testReserva.id)}/encuesta`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            puntaje: 3,
            comentario: 'Intento duplicado',
            token: testReserva.gestion_token,
          }),
        }
      );
      assert.strictEqual(resDup.status, 409, 'Encuesta duplicada debe responder 409 Conflict');
    });

    await test('GET /reservas/:id/encuesta refleja ya_respondida=true y protege PII sin token', async () => {
      // Sin token: código y nombre enmascarados, sin exponer comentario
      const resNoToken = await fetch(
        `${baseUrl}/reservas/${encodeURIComponent(testReserva.id)}/encuesta`
      );
      const jsonNoToken = await resNoToken.json();
      assert.strictEqual(resNoToken.status, 200);
      assert.strictEqual(jsonNoToken.data.ya_respondida, true);
      assert.ok(jsonNoToken.data.codigo_reserva.startsWith('PC-***-'));
      assert.strictEqual(jsonNoToken.data.encuesta.comentario, undefined);

      // Con token: código completo y comentario visible
      const resWithToken = await fetch(
        `${baseUrl}/reservas/${encodeURIComponent(testReserva.id)}/encuesta?token=${encodeURIComponent(
          testReserva.gestion_token
        )}`
      );
      const jsonWithToken = await resWithToken.json();
      assert.strictEqual(resWithToken.status, 200);
      assert.strictEqual(jsonWithToken.data.codigo_reserva, testReserva.codigo_reserva);
      assert.strictEqual(
        jsonWithToken.data.encuesta.comentario,
        'Fascinada con el resultado del balayage QA, atención impecable.'
      );
    });

    await test('GET /encuestas (Admin) lista la encuesta enriquecida con KPIs y soporta filtros', async () => {
      const resAll = await fetch(`${baseUrl}/encuestas`, {
        headers: authHeaders,
      });
      const jsonAll = await resAll.json();
      assert.strictEqual(resAll.status, 200);
      assert.strictEqual(jsonAll.status, 'success');
      assert.ok(jsonAll.stats && jsonAll.stats.total >= 1);

      const encontrada = jsonAll.data.find(
        (e) => String(e.reserva_id) === String(testReserva.id)
      );
      assert.ok(encontrada, 'La encuesta recién respondida debe aparecer en el panel admin');
      assert.strictEqual(encontrada.codigo_reserva, testReserva.codigo_reserva);
      assert.strictEqual(encontrada.cliente_nombre, 'Valeria QA Encuesta');
      assert.strictEqual(encontrada.puntaje, 5);
      assert.ok(encontrada.servicio_nombre.includes('Balayage'));

      // Filtro por búsqueda de código
      const resSearch = await fetch(
        `${baseUrl}/encuestas?busqueda=${encodeURIComponent(testReserva.codigo_reserva)}`,
        { headers: authHeaders }
      );
      const jsonSearch = await resSearch.json();
      assert.strictEqual(resSearch.status, 200);
      assert.strictEqual(jsonSearch.data.length, 1);
      assert.strictEqual(jsonSearch.data[0].codigo_reserva, testReserva.codigo_reserva);

      // Filtro por puntaje=1 (no debe incluir la encuesta de 5 estrellas)
      const resP1 = await fetch(`${baseUrl}/encuestas?puntaje=1`, {
        headers: authHeaders,
      });
      const jsonP1 = await resP1.json();
      assert.strictEqual(resP1.status, 200);
      assert.strictEqual(
        jsonP1.data.some((e) => String(e.reserva_id) === String(testReserva.id)),
        false
      );
    });

    await test('GET /encuestas/:id obtiene detalle y DELETE /encuestas/:id elimina el registro', async () => {
      const resDetail = await fetch(
        `${baseUrl}/encuestas/${encodeURIComponent(testReserva.id)}`,
        { headers: authHeaders }
      );
      const jsonDetail = await resDetail.json();
      assert.strictEqual(resDetail.status, 200);
      assert.strictEqual(jsonDetail.data.cliente_nombre, 'Valeria QA Encuesta');

      const resDel = await fetch(
        `${baseUrl}/encuestas/${encodeURIComponent(testReserva.id)}`,
        {
          method: 'DELETE',
          headers: authHeaders,
        }
      );
      assert.strictEqual(resDel.status, 200);

      // Verificar que ya no existe
      const resAfter = await fetch(
        `${baseUrl}/encuestas/${encodeURIComponent(testReserva.id)}`,
        { headers: authHeaders }
      );
      assert.strictEqual(resAfter.status, 404);
    });
  } finally {
    // Restaurar estado original del archivo .store para no dejar datos de prueba
    try {
      if (storeExistedBefore && storeBackup !== null) {
        fs.writeFileSync(storePath, storeBackup, 'utf8');
      } else if (!storeExistedBefore && fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
      }
    } catch (_) {}

    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n==============================================================');
  console.log(`📊 RESUMEN QA ENCUESTAS: ${passed} pasaron | ${failed} fallaron`);
  console.log('==============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error fatal ejecutando suite QA Encuestas:', err);
  process.exit(1);
});

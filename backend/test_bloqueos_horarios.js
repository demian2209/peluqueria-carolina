require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const assert = require('assert');
const http = require('http');
const app = require('./src/app');
const { generarTokenAdmin } = require('./src/utils/reservaToken.utils');
const {
  calcularDisponibilidad,
  evaluarBloqueoParaSlot,
} = require('./src/utils/disponibilidad.utils');

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
    console.error(`     → ${err.message}${err.cause ? ` (${err.cause.code || err.cause.message})` : ''}`);
  }
}

async function run() {
  console.log('==============================================================');
  console.log('🧪 QA SUITE: MÓDULO DE BLOQUEO DE HORAS Y HORARIOS');
  console.log('==============================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. PRUEBAS UNITARIAS (disponibilidad.utils.js)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Pruebas Unitarias (Motor de Disponibilidad y Bloqueos) ---');

  const horarioBase = [{ dia_semana: 3, hora_inicio: '09:00', hora_fin: '18:00' }]; // Miércoles
  const fechaMiercoles = '2027-05-12'; // Miércoles futuro

  await test('Bloqueo de día completo devuelve 0 slots y marca bloqueadoDiaCompleto=true', () => {
    const res = calcularDisponibilidad({
      fecha: fechaMiercoles,
      duracionMin: 60,
      horarios: horarioBase,
      reservas: [],
      bloqueos: [{ dia_completo: true, activo: true, motivo: 'Feriado Nacional' }],
    });
    assert.strictEqual(res.trabajaEseDia, true);
    assert.strictEqual(res.bloqueadoDiaCompleto, true);
    assert.strictEqual(res.motivoBloqueo, 'Feriado Nacional');
    assert.deepStrictEqual(res.slots, []);
  });

  await test('Bloqueo parcial (13:00–14:00) excluye solo bloques solapados y respeta fronteras exactas', () => {
    const res = calcularDisponibilidad({
      fecha: fechaMiercoles,
      duracionMin: 60,
      horarios: horarioBase,
      reservas: [],
      bloqueos: [{ dia_completo: false, activo: true, hora_inicio: '13:00', hora_fin: '14:00' }],
    });
    assert.strictEqual(res.bloqueadoDiaCompleto, false);
    assert.ok(res.slots.includes('12:00'), 'Slot 12:00–13:00 (frontera izquierda) debe quedar disponible');
    assert.ok(!res.slots.includes('13:00'), 'Slot 13:00–14:00 debe quedar bloqueado');
    assert.ok(res.slots.includes('14:00'), 'Slot 14:00–15:00 (frontera derecha) debe quedar disponible');
  });

  await test('Bloqueo parcial que solapa parcialmente un servicio largo (12:30–13:00) descarta slot 12:00–15:00', () => {
    const res = calcularDisponibilidad({
      fecha: fechaMiercoles,
      duracionMin: 180,
      horarios: horarioBase,
      reservas: [],
      bloqueos: [{ dia_completo: false, activo: true, hora_inicio: '12:30', hora_fin: '13:00' }],
    });
    assert.deepStrictEqual(res.slots, ['09:00', '15:00']);
  });

  await test('Bloqueo pausado (activo=false) no afecta los slots disponibles', () => {
    const res = calcularDisponibilidad({
      fecha: fechaMiercoles,
      duracionMin: 180,
      horarios: horarioBase,
      reservas: [],
      bloqueos: [{ dia_completo: true, activo: false, motivo: 'Pausado' }],
    });
    assert.strictEqual(res.bloqueadoDiaCompleto, false);
    assert.deepStrictEqual(res.slots, ['09:00', '12:00', '15:00']);
  });

  await test('evaluarBloqueoParaSlot detecta solapamiento parcial y día completo', () => {
    const r1 = evaluarBloqueoParaSlot({
      bloqueos: [{ dia_completo: false, activo: true, hora_inicio: '13:00', hora_fin: '14:00', motivo: 'Colación' }],
      startMin: 12 * 60 + 30,
      endMin: 13 * 60 + 30,
    });
    assert.strictEqual(r1.bloqueado, true);
    assert.strictEqual(r1.diaCompleto, false);

    const r2 = evaluarBloqueoParaSlot({
      bloqueos: [{ dia_completo: false, activo: true, hora_inicio: '13:00', hora_fin: '14:00', motivo: 'Colación' }],
      startMin: 14 * 60,
      endMin: 15 * 60,
    });
    assert.strictEqual(r2.bloqueado, false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. PRUEBAS DE INTEGRACIÓN HTTP (API + Disponibilidad + Reservas)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Pruebas de Integración HTTP (/api/v1/bloqueos, /disponibilidad, /reservas) ---');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const apiBase = `http://127.0.0.1:${port}/api/v1`;

  const adminToken = generarTokenAdmin(process.env.ADMIN_EMAIL || 'carolina@peluqueria.cl');
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  const createdIds = [];

  try {
    await test('Autorización: GET /bloqueos sin token retorna 401', async () => {
      const res = await fetch(`${apiBase}/bloqueos`);
      assert.strictEqual(res.status, 401);
    });

    await test('Autorización: POST /bloqueos sin token retorna 401', async () => {
      const res = await fetch(`${apiBase}/bloqueos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'fecha', fecha: '2027-05-12', dia_completo: true }),
      });
      assert.strictEqual(res.status, 401);
    });

    await test('Validación: hora_fin <= hora_inicio retorna 400', async () => {
      const res = await fetch(`${apiBase}/bloqueos`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          estilista_id: 'e1-carolina-valenzuela',
          tipo: 'fecha',
          fecha: '2027-05-12',
          dia_completo: false,
          hora_inicio: '15:00',
          hora_fin: '14:00',
        }),
      });
      assert.strictEqual(res.status, 400);
    });

    await test('Validación: fecha pasada retorna 400', async () => {
      const res = await fetch(`${apiBase}/bloqueos`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          estilista_id: 'todos',
          tipo: 'fecha',
          fecha: '2020-01-01',
          dia_completo: true,
        }),
      });
      assert.strictEqual(res.status, 400);
    });

    await test('Validación: dia_semana fuera de rango (9) retorna 400', async () => {
      const res = await fetch(`${apiBase}/bloqueos`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          estilista_id: 'todos',
          tipo: 'recurrente',
          dia_semana: 9,
          dia_completo: true,
        }),
      });
      assert.strictEqual(res.status, 400);
    });

    // Flujo completo: Bloqueo de rango horario por fecha específica
    let bloqueoRangoId = null;
    await test('CRUD + Disponibilidad + Reserva: bloqueo parcial 12:00–15:00 oculta slot y rechaza reserva con 409', async () => {
      const resCreate = await fetch(`${apiBase}/bloqueos`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          estilista_id: 'e1-carolina-valenzuela',
          tipo: 'fecha',
          fecha: '2027-05-12',
          dia_completo: false,
          hora_inicio: '12:00',
          hora_fin: '15:00',
          motivo: 'Capacitación QA',
        }),
      });
      const jsonCreate = await resCreate.json();
      assert.strictEqual(resCreate.status, 201, `Esperado 201, recibido ${resCreate.status}: ${JSON.stringify(jsonCreate)}`);
      bloqueoRangoId = jsonCreate.data.id;
      createdIds.push(bloqueoRangoId);

      // Duplicado debe retornar 409
      const resDup = await fetch(`${apiBase}/bloqueos`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          estilista_id: 'e1-carolina-valenzuela',
          tipo: 'fecha',
          fecha: '2027-05-12',
          dia_completo: false,
          hora_inicio: '12:00',
          hora_fin: '15:00',
        }),
      });
      assert.strictEqual(resDup.status, 409);

      // Disponibilidad debe omitir 12:00 para Balayage (180 min)
      const resDisp = await fetch(
        `${apiBase}/disponibilidad?estilista_id=e1-carolina-valenzuela&fecha=2027-05-12&servicio_id=s4-balayage&duracion_min=180`
      );
      const jsonDisp = await resDisp.json();
      assert.strictEqual(resDisp.status, 200);
      assert.ok(!jsonDisp.data.slots_disponibles.includes('12:00'), '12:00 no debe aparecer disponible');
      assert.ok(jsonDisp.data.slots_disponibles.includes('09:00'), '09:00 debe seguir disponible');
      assert.ok(jsonDisp.data.slots_disponibles.includes('15:00'), '15:00 debe seguir disponible');

      // Intentar reservar 12:00 directo por API debe fallar con 409
      const resReserva = await fetch(`${apiBase}/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nombre: 'QA Bloqueo Test',
          cliente_email: 'qa.bloqueo@peluqueria.cl',
          cliente_telefono: '+56912345678',
          estilista_id: 'e1-carolina-valenzuela',
          servicio_id: 's4-balayage',
          fecha: '2027-05-12',
          hora_inicio: '12:00',
        }),
      });
      assert.strictEqual(resReserva.status, 409, 'Backend debe rechazar reserva en horario bloqueado con 409');

      // Pausar bloqueo debe restaurar el slot 12:00
      const resPause = await fetch(`${apiBase}/bloqueos/${bloqueoRangoId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ activo: false }),
      });
      assert.strictEqual(resPause.status, 200);

      const resDispAfter = await fetch(
        `${apiBase}/disponibilidad?estilista_id=e1-carolina-valenzuela&fecha=2027-05-12&servicio_id=s4-balayage&duracion_min=180`
      );
      const jsonDispAfter = await resDispAfter.json();
      assert.ok(jsonDispAfter.data.slots_disponibles.includes('12:00'), '12:00 debe volver al pausar el bloqueo');
    });

    // Flujo completo: Bloqueo de día completo para Todo el Salón
    await test('Bloqueo de día completo global ("todos") bloquea a todos los estilistas y reporta motivo', async () => {
      const resCreate = await fetch(`${apiBase}/bloqueos`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          estilista_id: 'todos',
          tipo: 'fecha',
          fecha: '2027-05-13',
          dia_completo: true,
          motivo: 'Feriado QA Salón Cerrado',
        }),
      });
      const jsonCreate = await resCreate.json();
      assert.strictEqual(resCreate.status, 201);
      createdIds.push(jsonCreate.data.id);

      const resCaro = await fetch(
        `${apiBase}/disponibilidad?estilista_id=e1-carolina-valenzuela&fecha=2027-05-13&servicio_id=s4-balayage&duracion_min=180`
      );
      const jsonCaro = await resCaro.json();
      assert.strictEqual(jsonCaro.data.bloqueado_dia_completo, true);
      assert.strictEqual(jsonCaro.data.motivo_bloqueo, 'Feriado QA Salón Cerrado');
      assert.deepStrictEqual(jsonCaro.data.slots_disponibles, []);

      const resMatias = await fetch(
        `${apiBase}/disponibilidad?estilista_id=e2-matias-munoz&fecha=2027-05-13&servicio_id=s2-corte-caballero&duracion_min=40`
      );
      const jsonMatias = await resMatias.json();
      assert.strictEqual(jsonMatias.data.bloqueado_dia_completo, true);
      assert.deepStrictEqual(jsonMatias.data.slots_disponibles, []);
    });

    // Flujo completo: Bloqueo recurrente semanal
    await test('Bloqueo recurrente semanal (Viernes 13:00–14:00) aplica solo a viernes y no a jueves', async () => {
      const resCreate = await fetch(`${apiBase}/bloqueos`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          estilista_id: 'e2-matias-munoz',
          tipo: 'recurrente',
          dia_semana: 5, // Viernes
          dia_completo: false,
          hora_inicio: '13:00',
          hora_fin: '14:00',
          motivo: 'Colación recurrente QA',
        }),
      });
      const jsonCreate = await resCreate.json();
      assert.strictEqual(resCreate.status, 201);
      createdIds.push(jsonCreate.data.id);

      // 2027-05-14 es Viernes
      const resViernes = await fetch(
        `${apiBase}/disponibilidad?estilista_id=e2-matias-munoz&fecha=2027-05-14&servicio_id=s2-corte-caballero&duracion_min=60`
      );
      const jsonViernes = await resViernes.json();
      assert.ok(!jsonViernes.data.slots_disponibles.includes('13:00'), 'Viernes 13:00 debe estar bloqueado');
      assert.ok(jsonViernes.data.slots_disponibles.includes('12:00'), 'Viernes 12:00 debe estar libre');
      assert.ok(jsonViernes.data.slots_disponibles.includes('14:00'), 'Viernes 14:00 debe estar libre');

      // 2027-05-18 es Martes (no debe bloquearse)
      const resMartes = await fetch(
        `${apiBase}/disponibilidad?estilista_id=e2-matias-munoz&fecha=2027-05-18&servicio_id=s2-corte-caballero&duracion_min=60`
      );
      const jsonMartes = await resMartes.json();
      assert.ok(jsonMartes.data.slots_disponibles.includes('13:00'), 'Martes 13:00 NO debe estar bloqueado');
    });
  } finally {
    // Limpieza estricta de todos los bloqueos creados en la prueba
    for (const id of createdIds) {
      try {
        await fetch(`${apiBase}/bloqueos/${id}`, {
          method: 'DELETE',
          headers: adminHeaders,
        });
      } catch (_) {}
    }
    server.close();
  }

  console.log('\n==============================================================');
  console.log(`📊 RESUMEN QA: ${passed} pasaron | ${failed} fallaron`);
  console.log('==============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error fatal ejecutando suite QA:', err);
  process.exit(1);
});

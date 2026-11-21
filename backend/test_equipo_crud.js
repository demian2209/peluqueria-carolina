require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('./src/app');
const { generarTokenAdmin } = require('./src/utils/reservaToken.utils');

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

// PNG 1x1 válido (con magic bytes reales 89 50 4E 47)
const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function run() {
  console.log('==============================================================');
  console.log('🧪 QA SUITE: CRUD DE EQUIPO (ESTILISTAS) & SINCRONIZACIÓN');
  console.log('==============================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const adminToken = generarTokenAdmin('qa-admin@peluqueriacarolina.cl');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  let createdId = null;
  let createdFotoUrl = null;

  try {
    console.log('--- 1. Autorización y Validación de Inputs ---');

    await test('POST /estilistas sin token debe responder 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/estilistas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: 'Test Sin Auth' }),
      });
      assert.strictEqual(res.status, 401);
    });

    await test('POST /estilistas con nombre inválido (<2 chars) debe responder 400', async () => {
      const res = await fetch(`${baseUrl}/estilistas`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ nombre: 'A', bio: 'Descripción válida' }),
      });
      assert.strictEqual(res.status, 400);
    });

    await test('POST /estilistas con imagen_base64 inválida debe responder 400', async () => {
      const res = await fetch(`${baseUrl}/estilistas`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          nombre: 'Lucía',
          apellido: 'Paredes',
          imagen_base64: 'data:text/plain;base64,SG9sYQ==',
        }),
      });
      assert.strictEqual(res.status, 400);
    });

    console.log('\n--- 2. Flujo CRUD Completo (Crear, Leer, Editar, Visibilidad, Eliminar) ---');

    await test('POST /estilistas crea nuevo miembro con imagen base64 válida y retorna 201', async () => {
      const res = await fetch(`${baseUrl}/estilistas`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          nombre: 'Sofía QA',
          apellido: 'Herrera',
          especialidad: 'Colorista & Visagismo',
          bio: 'Especialista en técnicas de iluminación natural y cuidado capilar orgánico.',
          nivel: 'senior',
          activo: true,
          orden: 6,
          imagen_base64: VALID_PNG_BASE64,
        }),
      });
      const json = await res.json();
      assert.strictEqual(res.status, 201, `Esperado 201, recibido ${res.status}: ${json.message}`);
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.id, 'Debe devolver un ID');
      assert.strictEqual(json.data.nombre, 'Sofía QA');
      assert.strictEqual(json.data.activo, true);
      assert.ok(
        String(json.data.foto_url).startsWith('/images/maestros_tijera/'),
        `foto_url esperada en /images/maestros_tijera/, recibida: ${json.data.foto_url}`
      );
      createdId = json.data.id;
      createdFotoUrl = json.data.foto_url;
    });

    await test('GET /estilistas público incluye al nuevo miembro visible', async () => {
      const res = await fetch(`${baseUrl}/estilistas`);
      const json = await res.json();
      assert.strictEqual(res.status, 200);
      const found = json.data.find((e) => String(e.id) === String(createdId));
      assert.ok(found, 'El nuevo miembro debe aparecer en el listado público');
      assert.strictEqual(found.bio, 'Especialista en técnicas de iluminación natural y cuidado capilar orgánico.');
    });

    await test('PATCH /estilistas/:id actualiza nombre, descripción y orden', async () => {
      const res = await fetch(`${baseUrl}/estilistas/${encodeURIComponent(createdId)}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          nombre: 'Sofía Editada',
          bio: 'Biografía actualizada desde QA.',
          orden: 2,
        }),
      });
      const json = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.nombre, 'Sofía Editada');
      assert.strictEqual(json.data.bio, 'Biografía actualizada desde QA.');
      assert.strictEqual(json.data.orden, 2);
    });

    await test('PATCH /estilistas/:id/visibilidad oculta al miembro del sitio público pero sigue visible en Admin', async () => {
      const toggleRes = await fetch(
        `${baseUrl}/estilistas/${encodeURIComponent(createdId)}/visibilidad`,
        {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ activo: false }),
        }
      );
      const toggleJson = await toggleRes.json();
      assert.strictEqual(toggleRes.status, 200);
      assert.strictEqual(toggleJson.data.activo, false);

      // Público NO debe verlo
      const pubRes = await fetch(`${baseUrl}/estilistas`);
      const pubJson = await pubRes.json();
      assert.strictEqual(
        pubJson.data.some((e) => String(e.id) === String(createdId)),
        false,
        'Un miembro oculto no debe aparecer en GET /estilistas público'
      );

      // Público intentando incluir_inactivos=true SIN token tampoco debe verlo
      const unauthRes = await fetch(`${baseUrl}/estilistas?incluir_inactivos=true`);
      const unauthJson = await unauthRes.json();
      assert.strictEqual(
        unauthJson.data.some((e) => String(e.id) === String(createdId)),
        false,
        'incluir_inactivos=true sin token admin no debe exponer ocultos'
      );

      // Admin CON token SÍ debe verlo
      const adminRes = await fetch(`${baseUrl}/estilistas?incluir_inactivos=true`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const adminJson = await adminRes.json();
      assert.strictEqual(
        adminJson.data.some((e) => String(e.id) === String(createdId)),
        true,
        'Admin con token debe ver al miembro oculto'
      );
    });

    await test('PATCH /estilistas/:id/visibilidad vuelve a activar al miembro y reaparece en público', async () => {
      const toggleRes = await fetch(
        `${baseUrl}/estilistas/${encodeURIComponent(createdId)}/visibilidad`,
        {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ activo: true }),
        }
      );
      assert.strictEqual(toggleRes.status, 200);

      const pubRes = await fetch(`${baseUrl}/estilistas`);
      const pubJson = await pubRes.json();
      assert.strictEqual(
        pubJson.data.some((e) => String(e.id) === String(createdId)),
        true,
        'El miembro reactivado debe volver a aparecer en público'
      );
    });

    await test('GET /disponibilidad responde 200 con horarios para el nuevo miembro del equipo', async () => {
      const res = await fetch(
        `${baseUrl}/disponibilidad?estilista_id=${encodeURIComponent(createdId)}&fecha=2027-05-12&servicio_id=s1-corte-mujer&duracion_min=50`
      );
      const json = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.status, 'success');
      assert.ok(Array.isArray(json.data.slots_disponibles) && json.data.slots_disponibles.length > 0);
    });

    await test('DELETE /estilistas/:id elimina al miembro de prueba', async () => {
      const res = await fetch(`${baseUrl}/estilistas/${encodeURIComponent(createdId)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert.strictEqual(res.status, 200);

      const adminRes = await fetch(`${baseUrl}/estilistas?incluir_inactivos=true`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const adminJson = await adminRes.json();
      assert.strictEqual(
        adminJson.data.some((e) => String(e.id) === String(createdId)),
        false,
        'El miembro eliminado no debe aparecer en el listado'
      );
    });
  } finally {
    // Limpiar imagen temporal generada durante el test
    if (createdFotoUrl && createdFotoUrl.startsWith('/images/maestros_tijera/')) {
      const filePath = path.resolve(__dirname, '../frontend/public', createdFotoUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }
    }
    // Limpiar rastro de prueba en estilistas_meta.store si se creó solo para el test
    const metaStorePath = path.resolve(__dirname, 'src/database/estilistas_meta.store');
    if (createdId && fs.existsSync(metaStorePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(metaStorePath, 'utf8'));
        if (raw.deletedIds) delete raw.deletedIds[String(createdId)];
        if (raw.byId) delete raw.byId[String(createdId)];
        if (Array.isArray(raw.mockItems)) {
          raw.mockItems = raw.mockItems.filter((item) => String(item.id) !== String(createdId));
        }
        fs.writeFileSync(metaStorePath, JSON.stringify(raw, null, 2), 'utf8');
      } catch (_) {}
    }

    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n==============================================================');
  console.log(`📊 RESULTADO: ${passed} pasaron | ${failed} fallaron`);
  console.log('==============================================================');
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Error fatal en QA Suite:', err);
  process.exit(1);
});

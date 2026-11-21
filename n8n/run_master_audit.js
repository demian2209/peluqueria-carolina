/**
 * MASTER AUDIT SUITE - PELUQUERÍA CAROLINA
 * Ejecuta de forma secuencial y estructurada toda la suite E2E
 * de los 6 Pilares Técnicos y los 8 Workflows de n8n (PC01 - PC08).
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const testSuites = [
  {
    pilar: 'Pilar A & Backend Lifecycle',
    name: 'Backend Express: Ciclo de vida y Despacho Asíncrono',
    script: 'backend/test_paso1_reservas.js',
  },
  {
    pilar: 'Pilar A & B (Router Dual)',
    name: 'PC06 Router: Nomenclatura Dual y Despacho a Sub-Workflows',
    script: 'n8n/test_e2e_paso2_router.js',
  },
  {
    pilar: 'Pilar C & D (Automatización Cron)',
    name: 'Workers Cron: Recordatorios 24h (PC02) y Cierre Atendidas (PC05)',
    script: 'backend/test_paso3_automatizacion.js',
  },
  {
    pilar: 'Pilar B & F (Workflows)',
    name: 'PC01: Confirmación de Cita (WhatsApp + Email + Idempotencia)',
    script: 'n8n/test_e2e_reserva.js',
  },
  {
    pilar: 'Pilar C & F (Workflows)',
    name: 'PC02: Recordatorio Preventivo 24H (WhatsApp + Email + Idempotencia)',
    script: 'n8n/test_e2e_recordatorio.js',
  },
  {
    pilar: 'Pilar B & F (Workflows)',
    name: 'PC03: Cancelación de Cita (WhatsApp + Email + Idempotencia)',
    script: 'n8n/test_e2e_cancelacion.js',
  },
  {
    pilar: 'Pilar B & F (Workflows)',
    name: 'PC04: Reprogramación de Cita (WhatsApp + Email + Idempotencia)',
    script: 'n8n/test_e2e_reprogramacion.js',
  },
  {
    pilar: 'Pilar D & F (Workflows)',
    name: 'PC05: Seguimiento y Encuesta (WhatsApp + Email + Idempotencia)',
    script: 'n8n/test_e2e_seguimiento.js',
  },
  {
    pilar: 'Pilar E (Inteligencia Artificial)',
    name: 'PC07: Asistente Virtual Gemini (Contexto Real, Anti-Prompt Injection, Sanitización)',
    script: 'n8n/test_e2e_gemini.js',
  },
  {
    pilar: 'Pilar D & Supabase Persistencia',
    name: 'PC08: Recepción de Encuesta (Persistencia DB, HTTP 400, 404, 409 Idempotencia)',
    script: 'n8n/test_e2e_encuesta.js',
  },
];

function runScript(item) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    console.log(`\n================================================================`);
    console.log(`▶ [${item.pilar}] ${item.name}`);
    console.log(`  Ejecutando: node ${item.script}`);
    console.log(`================================================================`);

    const child = spawn('node', [item.script], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      resolve({
        pilar: item.pilar,
        name: item.name,
        script: item.script,
        duration: `${duration}s`,
        exitCode: code,
        passed: code === 0,
      });
    });
  });
}

async function main() {
  console.log('################################################################');
  console.log('🚀 INICIANDO AUDITORÍA TÉCNICA Y SUITE DE PRUEBAS E2E COMPLETA');
  console.log('   Peluquería Carolina - Integración Full-Stack n8n / Express / Supabase');
  console.log('################################################################\n');

  const globalStart = Date.now();
  const report = [];

  for (const item of testSuites) {
    const res = await runScript(item);
    report.push(res);
    if (!res.passed) {
      console.error(`\n❌ FALLO CRÍTICO EN: ${item.name}`);
      break;
    }
    // Pausa breve entre suites para estabilización de conexiones de red y sockets
    await new Promise((r) => setTimeout(r, 1000));
  }

  const totalTime = ((Date.now() - globalStart) / 1000).toFixed(2);

  console.log('\n\n================================================================');
  console.log('📊 RESUMEN EJECUTIVO DE CERTIFICACIÓN TÉCNICA E2E');
  console.log('================================================================');
  console.table(
    report.map((r) => ({
      Pilar: r.pilar,
      Módulo: r.name,
      Duración: r.duration,
      Estado: r.passed ? '✅ PASSED (100%)' : '❌ FAILED',
    }))
  );

  const allPassed = report.every((r) => r.passed);
  console.log(`Tiempo total de ejecución: ${totalTime}s`);
  if (allPassed && report.length === testSuites.length) {
    console.log('\n🏆 CERTIFICACIÓN TOTAL APROBADA: 10/10 SUITES EN VERDE (100% GREEN)');
    console.log('Todos los requerimientos de la auditoría técnica han sido subsanados y validados.');
    process.exit(0);
  } else {
    console.error('\n⚠️ AUDITORÍA CON FALLOS DETECTADOS.');
    process.exit(1);
  }
}

main();

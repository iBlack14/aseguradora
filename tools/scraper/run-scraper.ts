#!/usr/bin/env node
/**
 * run-scraper.ts — CLI para ejecutar el scraper de tarifas SOAT
 *
 * Uso:
 *   npx tsx tools/scraper/run-scraper.ts
 *   npx tsx tools/scraper/run-scraper.ts --plate ABC-123 --type AUTO --dept Lima
 *   npx tsx tools/scraper/run-scraper.ts --insurer interseguro --no-cache
 *   npx tsx tools/scraper/run-scraper.ts --push-api http://localhost:4000
 *
 * Variables de entorno opcionales:
 *   ADMIN_API_KEY   — clave para enviar tarifas a la API
 *   HEADLESS=false  — mostrar navegador (útil para debug)
 */

import { scrapeAllInsurers } from './orchestrator';
import type { ScrapeInput, VehicleType, VehicleUse } from './types';

// ── Parsear argumentos CLI ──────────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}
function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

// Configuración con defaults razonables
const plate          = getArg('--plate',     'ABC-123');
const vehicleType    = getArg('--type',      'AUTO') as VehicleType;
const department     = getArg('--dept',      'Lima');
const use            = getArg('--use',       'PARTICULAR') as VehicleUse;
const documentType   = getArg('--doc-type',  'DNI');
const documentNumber = getArg('--doc-num',   '12345678');
const startsAt       = getArg('--starts',    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
const pushToApi      = getArg('--push-api',  process.env.API_URL || '');
const insurerFilter  = getArg('--insurer',   '').split(',').filter(Boolean);
const noCache        = hasFlag('--no-cache');
const sequential     = hasFlag('--sequential');
const headless       = process.env.HEADLESS !== 'false';

// ── Input principal ─────────────────────────────────────────────────────────
const input: ScrapeInput = {
  plate,
  vehicleType,
  department,
  use,
  documentType,
  documentNumber,
  startsAt,
};

// ── Banner ──────────────────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════════╗
║   🕷️  Scraper de Tarifas SOAT — Seguros Falabella    ║
╚══════════════════════════════════════════════════════╝

  Vehículo:    ${vehicleType} / ${plate}
  Departamento: ${department} / Uso: ${use}
  Fecha inicio: ${startsAt}
  Modo:         ${headless ? 'Headless (sin ventana)' : '👁️  Visible (debug)'}
  Caché:        ${noCache ? '❌ Desactivada' : '✅ Activada (TTL 24h)'}
  Modo ejecución: ${sequential ? 'Secuencial' : 'Paralelo'}
  ${pushToApi ? `API destino: ${pushToApi}` : 'Sin push a API'}
  ${insurerFilter.length ? `Aseguradoras: ${insurerFilter.join(', ')}` : 'Todas las aseguradoras'}
`);

// ── Ejecutar ─────────────────────────────────────────────────────────────────
async function main() {
  const result = await scrapeAllInsurers(input, {
    useCache:  !noCache,
    parallel:  !sequential,
    headless,
    insurers:  insurerFilter.length > 0 ? insurerFilter : undefined,
    pushToApi: pushToApi || undefined,
  });

  // ── Resultado final ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log('📊 RESUMEN FINAL');
  console.log('══════════════════════════════════════════════════════');

  if (result.offers.length > 0) {
    console.log(`\n✅ ${result.offers.length} tarifas obtenidas para ${vehicleType} en ${department}:\n`);

    // Ordenar por precio
    const sorted = [...result.offers].sort((a, b) => a.price - b.price);
    const maxLen  = Math.max(...sorted.map(o => o.insurerName.length));

    for (const offer of sorted) {
      const badge = offer.confidence === 'HIGH' ? '🟢' : offer.confidence === 'MEDIUM' ? '🟡' : '🔴';
      console.log(
        `  ${badge} ${offer.insurerName.padEnd(maxLen + 2)} S/ ${offer.price.toFixed(2).padStart(7)}` +
        `  [${offer.confidence}] ${offer.planName}`
      );
    }

    const min = sorted[0].price;
    const max = sorted[sorted.length - 1].price;
    console.log(`\n  Mínimo: S/ ${min.toFixed(2)} | Máximo: S/ ${max.toFixed(2)} | Ahorro: S/ ${(max - min).toFixed(2)}`);
  } else {
    console.log('\n❌ No se obtuvieron precios.');
  }

  if (result.errors.length > 0) {
    console.log('\n⚠️  Errores registrados:');
    result.errors.forEach(e => console.log(`  • ${e}`));
  }

  console.log(`\n⏱️  Tiempo total: ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log('\n💡 Sugerencias:');
  console.log('  • Si hay pantallas vacías: HEADLESS=false npx tsx tools/scraper/run-scraper.ts');
  console.log('  • Ver screenshots de debug: tools/scraper/debug/');
  console.log('  • Ver caché JSON: tmp/scraper-cache/');
  console.log('  • Scraper una sola aseguradora: --insurer interseguro');

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Error fatal ejecutando el scraper:', err);
  process.exit(1);
});


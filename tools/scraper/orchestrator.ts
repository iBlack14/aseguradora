/**
 * orchestrator.ts
 * Orquestador principal del scraper de tarifas SOAT.
 *
 * - Ejecuta todos los scrapers en paralelo (configurable)
 * - Cachea resultados en JSON local (y en PostgreSQL si hay BD)
 * - Exporta resultado al servidor Fastify via HTTP
 * - Guarda informe de endpoints descubiertos
 */
import { createBrowser, createContext } from './browser';
import { scrapeLaPositiva } from './scrapers/lapositiva';
import { scrapeInterseguro } from './scrapers/interseguro';
import { scrapeMapfre } from './scrapers/mapfre';
import { scrapeProtecta } from './scrapers/protecta';
import { scrapePacifico } from './scrapers/pacifico';
import type { ScrapeInput, ScrapeResult, ScrapedOffer } from './types';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const CACHE_DIR  = path.resolve(process.cwd(), 'tmp', 'scraper-cache');
const DEBUG_DIR  = path.resolve(process.cwd(), 'tools', 'scraper', 'debug');
const CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 horas en ms

// ── Cache helpers ────────────────────────────────────────────────────────────

function cacheKey(input: ScrapeInput): string {
  return `${input.vehicleType}_${input.department}_${input.use}`.toLowerCase().replace(/\s/g, '-');
}

async function readCache(key: string): Promise<ScrapedOffer[] | null> {
  const file = path.join(CACHE_DIR, `${key}.json`);
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as { expiresAt: string; offers: ScrapedOffer[] };
    if (new Date(raw.expiresAt) < new Date()) {
      console.log(`  [Cache] Expirado para ${key}`);
      return null;
    }
    console.log(`  [Cache] ✅ Hit para ${key} (válido hasta ${raw.expiresAt})`);
    return raw.offers;
  } catch {
    return null;
  }
}

async function writeCache(key: string, offers: ScrapedOffer[]): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const expiresAt = new Date(Date.now() + CACHE_TTL).toISOString();
  await writeFile(
    path.join(CACHE_DIR, `${key}.json`),
    JSON.stringify({ expiresAt, offers, updatedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`  [Cache] Guardado ${key} → válido hasta ${expiresAt}`);
}

// ── Scrapers registry ───────────────────────────────────────────────────────

type ScraperFn = (ctx: Awaited<ReturnType<typeof createContext>>, input: ScrapeInput) => Promise<{ offers: ScrapedOffer[]; errors: string[] }>;

const SCRAPERS: Array<{ slug: string; fn: ScraperFn }> = [
  { slug: 'la-positiva', fn: scrapeLaPositiva },
  { slug: 'interseguro', fn: scrapeInterseguro },
  { slug: 'protecta',    fn: scrapeProtecta },
  { slug: 'mapfre',      fn: scrapeMapfre },
  { slug: 'pacifico',    fn: scrapePacifico },
];

// ── Orquestador principal ───────────────────────────────────────────────────

export async function scrapeAllInsurers(
  input: ScrapeInput,
  options: {
    useCache?: boolean;      // usar caché local (default: true)
    parallel?: boolean;      // ejecutar en paralelo (default: true)
    headless?: boolean;      // ocultar navegador (default: true)
    insurers?: string[];     // filtrar aseguradoras (default: todas)
    pushToApi?: string;      // URL de la API para enviar resultados
  } = {}
): Promise<ScrapeResult> {
  const {
    useCache   = true,
    parallel   = true,
    headless   = true,
    insurers   = SCRAPERS.map(s => s.slug),
    pushToApi,
  } = options;

  const startTime = Date.now();
  const allOffers: ScrapedOffer[] = [];
  const allErrors: string[] = [];

  await mkdir(DEBUG_DIR, { recursive: true });

  // ── Check cache ────────────────────────────────────────────────────────
  if (useCache) {
    const cached = await readCache(cacheKey(input));
    if (cached) {
      const filtered = cached.filter(o => insurers.includes(o.insurerSlug));
      console.log(`\n✅ Resultado desde caché: ${filtered.length} ofertas`);
      return { ok: true, offers: filtered, errors: [], input, durationMs: Date.now() - startTime };
    }
  }

  // ── Lanzar scrapers ────────────────────────────────────────────────────
  const activeScrapes = SCRAPERS.filter(s => insurers.includes(s.slug));
  console.log(`\n🚀 Iniciando scraping de ${activeScrapes.length} aseguradoras (modo: ${parallel ? 'paralelo' : 'secuencial'})...`);

  if (parallel) {
    // Paralelo: un browser por aseguradora
    const results = await Promise.allSettled(
      activeScrapes.map(async ({ slug, fn }) => {
        const browser = await createBrowser({ headless });
        const ctx     = await createContext(browser);
        try {
          console.log(`\n▶ [${slug}] Iniciando...`);
          return await fn(ctx, input);
        } finally {
          await ctx.close();
          await browser.close();
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allOffers.push(...result.value.offers);
        allErrors.push(...result.value.errors);
      } else {
        allErrors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      }
    }
  } else {
    // Secuencial: un solo browser reutilizado
    const browser = await createBrowser({ headless });
    for (const { slug, fn } of activeScrapes) {
      const ctx = await createContext(browser);
      console.log(`\n▶ [${slug}] Iniciando...`);
      try {
        const { offers, errors } = await fn(ctx, input);
        allOffers.push(...offers);
        allErrors.push(...errors);
      } catch (err) {
        allErrors.push(`${slug}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        await ctx.close();
      }
    }
    await browser.close();
  }

  // ── Guardar en caché ───────────────────────────────────────────────────
  if (allOffers.length > 0) {
    await writeCache(cacheKey(input), allOffers);
  }

  // ── Enviar a API (opcional) ────────────────────────────────────────────
  if (pushToApi && allOffers.length > 0) {
    await pushResultsToApi(pushToApi, allOffers, input);
  }

  // ── Guardar informe ────────────────────────────────────────────────────
  await saveReport({ input, offers: allOffers, errors: allErrors, durationMs: Date.now() - startTime });

  const ok = allOffers.length > 0;
  console.log(`\n${ ok ? '✅' : '❌' } Scraping finalizado en ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`   Ofertas: ${allOffers.length} | Errores: ${allErrors.length}`);
  allOffers.forEach(o => console.log(`   • ${o.insurerName}: S/ ${o.price} [${o.confidence}]`));
  if (allErrors.length) allErrors.forEach(e => console.warn(`   ⚠️  ${e}`));

  return { ok, offers: allOffers, errors: allErrors, input, durationMs: Date.now() - startTime };
}

// ── Push a API Fastify ───────────────────────────────────────────────────────

async function pushResultsToApi(apiBase: string, offers: ScrapedOffer[], input: ScrapeInput) {
  const tariffs = offers.map(o => ({
    insurerSlug:  o.insurerSlug,
    vehicleType:  input.vehicleType,
    vehicleUse:   input.use,
    department:   input.department,
    annualPrice:  o.price,
    source:       `SCRAPER:${o.confidence}`,
    notes:        `Scraped ${o.scrapedAt} desde ${o.source}`,
  }));

  try {
    const res = await fetch(`${apiBase}/v1/admin/tariffs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': process.env.ADMIN_API_KEY || '',
        'x-admin-role': 'ADMIN',
      },
      body: JSON.stringify(tariffs),
    });

    if (res.ok) {
      const data = await res.json() as { updated: number };
      console.log(`\n📤 ${data.updated} tarifas enviadas a la API`);
    } else {
      console.warn(`\n⚠️  API respondió ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error(`\n❌ Error enviando a API: ${err instanceof Error ? err.message : err}`);
  }
}

// ── Informe final ────────────────────────────────────────────────────────────

async function saveReport(data: {
  input: ScrapeInput;
  offers: ScrapedOffer[];
  errors: string[];
  durationMs: number;
}) {
  const filename = path.join(
    CACHE_DIR,
    `report-${data.input.vehicleType}-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}.json`
  );
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(filename, JSON.stringify(data, null, 2));
  console.log(`\n📄 Informe guardado: ${filename}`);
}

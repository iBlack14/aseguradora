/**
 * scraper-interseguro.ts
 * Cotizador: https://www.interseguro.com.pe/soat
 *
 * Interseguro tiene el proceso más sencillo y es 100% digital.
 * Tiende a exponer endpoints REST más claros.
 */
import type { BrowserContext } from 'playwright';
import type { ScrapeInput, ScrapedOffer } from '../types';
import { newPage, humanDelay, humanType, interceptJsonResponses } from '../browser';

const INSURER_SLUG = 'interseguro';
const INSURER_NAME = 'Interseguro';
const BASE_URL     = 'https://www.interseguro.pe/soat-digital/';

export async function scrapeInterseguro(
  context: BrowserContext,
  input: ScrapeInput
): Promise<{ offers: ScrapedOffer[]; errors: string[] }> {
  const page    = await newPage(context, 35_000);
  const errors: string[] = [];
  const offers: ScrapedOffer[] = [];
  const captured = interceptJsonResponses(page);

  try {
    console.log(`  [Interseguro] Navegando a ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await humanDelay(1500, 2500);

    // Cerrar modal/cookie banner si existe
    await page.click('[class*="close"], [aria-label="Cerrar"], button:has-text("Aceptar"), button:has-text("Cerrar")')
      .catch(() => {});
    await humanDelay(500);

    // ── Selección de tipo de vehículo ─────────────────────────────────────
    const vehicleMap: Record<string, string> = {
      AUTO: 'Auto',
      MOTO: 'Moto',
      MOTOTAXI: 'Mototaxi',
      VAN: 'Camioneta',
      CARGO: 'Carga',
    };
    const vehicleLabel = vehicleMap[input.vehicleType] || 'Auto';
    console.log(`  [Interseguro] Seleccionando tipo: ${vehicleLabel}`);

    // Interseguro usa tabs o botones para tipo de vehículo
    await page.click(
      `[data-type="${input.vehicleType}"], button:has-text("${vehicleLabel}"), ` +
      `li:has-text("${vehicleLabel}"), .vehicle-tab:has-text("${vehicleLabel}")`
    ).catch(() => {});
    await humanDelay();

    // ── Ingresar placa ─────────────────────────────────────────────────────
    const plateInput = await page.waitForSelector(
      'input[placeholder*="placa" i], input[name*="placa" i], input[id*="placa" i], input[name*="plate" i], input[type="text"]',
      { timeout: 15_000 }
    );
    console.log(`  [Interseguro] Ingresando placa: ${input.plate}`);
    await humanType(page, plateInput, input.plate.replace('-', ''));
    await humanDelay();

    // ── Submit ─────────────────────────────────────────────────────────────
    console.log(`  [Interseguro] Cotizando...`);
    const submitBtn = page.locator('button:visible').filter({ hasText: /cotizar ahora/i }).first();
    const fallbackBtn = page.locator('button:visible').filter({ hasText: /cotizar/i }).first();

    await Promise.all([
      page.waitForResponse(
        r => r.status() < 400 && (r.url().includes('cotiz') || r.url().includes('tarif') || r.url().includes('prima') || r.url().includes('soat')),
        { timeout: 15_000 }
      ).catch(() => null),
      (async () => {
        if ((await submitBtn.count()) > 0) {
          await submitBtn.click();
        } else if ((await fallbackBtn.count()) > 0) {
          await fallbackBtn.click();
        } else {
          await plateInput.press('Enter');
        }
      })().catch(async () => {
        await plateInput.press('Enter').catch(() => {});
      })
    ]);
    await humanDelay(2500, 4000);

    // ── Extraer precio ─────────────────────────────────────────────────────
    const priceFromXhr = extractPriceFromCaptures(captured, INSURER_SLUG);
    const priceFromDom = await extractPriceFromDom(page);
    const finalPrice = priceFromXhr ?? priceFromDom;

    if (finalPrice && finalPrice > 0) {
      offers.push({
        insurerSlug: INSURER_SLUG,
        insurerName: INSURER_NAME,
        price:       finalPrice,
        currency:    'PEN',
        planName:    'SOAT Digital Express',
        extras:      ['Emisión y entrega instantánea por correo', 'Orientación médica telefónica', 'Sincronización MTC inmediata'],
        scrapedAt:   new Date().toISOString(),
        source:      page.url(),
        confidence:  priceFromXhr ? 'HIGH' : 'MEDIUM',
      });
      console.log(`  [Interseguro] ✅ S/ ${finalPrice}`);
    } else {
      await page.screenshot({ path: `tools/scraper/debug/interseguro-${Date.now()}.png`, fullPage: true });
      errors.push('Interseguro: No se pudo extraer precio. Screenshot guardado.');
    }

    logEndpoints(INSURER_SLUG, captured);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Interseguro: ${msg}`);
    console.error(`  [Interseguro] ❌ ${msg}`);
    await page.screenshot({ path: `tools/scraper/debug/interseguro-error-${Date.now()}.png` }).catch(() => {});
  } finally {
    await page.close();
  }

  return { offers, errors };
}

async function extractPriceFromDom(page: import('playwright').Page): Promise<number | null> {
  return page.evaluate(() => {
    const selectors = ['.precio', '.price', '[class*="monto"]', '[class*="prima"]', '[class*="tarifa"]', '[class*="plan"]'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const text = el?.textContent ?? '';
        const match = text.match(/S\/?\s*(\d{2,4}(?:[.,]\d{1,2})?)/i);
        if (match) {
          const val = parseFloat(match[1].replace(',', '.'));
          if (val >= 25 && val <= 1000) return val;
        }
      }
    }
    const bodyText = document.body.innerText;
    const matches = Array.from(bodyText.matchAll(/S\/?\s*(\d{2,4}(?:[.,]\d{1,2})?)/gi));
    for (const m of matches) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (val >= 25 && val <= 1000) return val;
    }
    return null;
  }).catch(() => null);
}

function extractPriceFromCaptures(
  captured: Array<{ url: string; body: unknown; status: number }>,
  slug: string
): number | null {
  const keys = ['precio', 'prima', 'monto', 'amount', 'tarifa', 'price', 'importe', 'total', 'netPremium'];
  for (const { body, url } of captured) {
    if (typeof body !== 'object' || !body) continue;
    const price = deepSearch(body as Record<string, unknown>, keys);
    if (price && price > 10 && price < 5000) {
      console.log(`  [${slug}] 📡 Precio desde XHR: S/ ${price} (${url})`);
      return price;
    }
  }
  return null;
}

function deepSearch(obj: Record<string, unknown>, keys: string[], depth = 0): number | null {
  if (depth > 6) return null;
  for (const [k, v] of Object.entries(obj)) {
    if (keys.some(key => k.toLowerCase().includes(key))) {
      const n = Number(v);
      if (!isNaN(n) && n > 10) return n;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = deepSearch(v as Record<string, unknown>, keys, depth + 1);
      if (found) return found;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === 'object') {
          const found = deepSearch(item as Record<string, unknown>, keys, depth + 1);
          if (found) return found;
        }
      }
    }
  }
  return null;
}

function logEndpoints(slug: string, captured: Array<{ url: string; body: unknown }>) {
  const interesting = captured.filter(({ url }) =>
    /tarif|cotiz|precio|prime|soat/i.test(url)
  );
  if (interesting.length > 0) {
    console.log(`  [${slug}] 📡 Endpoints detectados:`);
    interesting.forEach(({ url }) => console.log(`    → ${url}`));
  }
}

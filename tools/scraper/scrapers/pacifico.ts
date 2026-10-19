/**
 * scraper-pacifico.ts
 * Cotizador: https://seguros.pacifico.com.pe/soat
 */
import type { BrowserContext } from 'playwright';
import type { ScrapeInput, ScrapedOffer } from '../types';
import { newPage, humanDelay, humanType, interceptJsonResponses } from '../browser';

const INSURER_SLUG = 'pacifico';
const INSURER_NAME = 'Pacífico';
const BASE_URL     = 'https://soat.pacifico.com.pe/';

export async function scrapePacifico(
  context: BrowserContext,
  input: ScrapeInput
): Promise<{ offers: ScrapedOffer[]; errors: string[] }> {
  const page    = await newPage(context, 35_000);
  const errors: string[] = [];
  const offers: ScrapedOffer[] = [];
  const captured = interceptJsonResponses(page);

  try {
    console.log(`  [Pacífico] Navegando a ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await humanDelay(1500, 2500);

    await page.click('button:has-text("Aceptar"), [class*="cookie"] button, #cookieAccept').catch(() => {});
    await humanDelay(500);

    // ── Tipo de vehículo ──────────────────────────────────────────────────
    const vehicleMap: Record<string, string> = {
      AUTO: 'Auto', MOTO: 'Moto', MOTOTAXI: 'Mototaxi',
      VAN: 'Camioneta', CARGO: 'Camión de carga'
    };
    const label = vehicleMap[input.vehicleType] || 'Auto';
    console.log(`  [Pacífico] Tipo: ${label}`);

    await page.click(
      `button:has-text("${label}"), label:has-text("${label}"), [data-tipo="${input.vehicleType}"]`
    ).catch(() => {});
    await humanDelay();

    // ── Placa ─────────────────────────────────────────────────────────────
    console.log(`  [Pacífico] Placa: ${input.plate}`);
    const plateEl = await page.waitForSelector(
      'input[name*="placa"], input[id*="placa"], input[placeholder*="laca"]',
      { timeout: 10_000 }
    );
    await humanType(
      page,
      await plateEl.evaluate(el => '#' + (el.id || 'noId')),
      input.plate.replace('-', '')
    );
    await humanDelay();

    // Algunos cotizadores de Pacífico piden fecha inicio
    const dateSel = await page.$('input[type="date"], input[name*="fecha"], input[placeholder*="echa"]');
    if (dateSel) {
      await humanType(
        page,
        await dateSel.evaluate(el => '#' + (el.id || 'noId')),
        input.startsAt.replace(/-/g, '/')
      );
      await humanDelay(400);
    }

    // ── Cotizar ────────────────────────────────────────────────────────────
    console.log(`  [Pacífico] Cotizando...`);
    await Promise.all([
      page.waitForResponse(
        r => r.status() < 400 && /tarif|cotiz|precio|prima|soat/i.test(r.url()),
        { timeout: 20_000 }
      ).catch(() => null),
      page.click('button[type="submit"], button:has-text("Cotizar"), button:has-text("Calcular mi precio")'),
    ]);
    await humanDelay(2500, 4000);

    // ── Precio ────────────────────────────────────────────────────────────
    const priceFromXhr = extractPrice(captured);
    const priceFromDom = await page.evaluate(() => {
      const allText = document.body.innerText;
      const match = allText.match(/S\/?\s*\.?\s*(\d{2,4}[.,]\d{2})/);
      return match ? parseFloat(match[1].replace(',', '.')) : null;
    }).catch(() => null);

    const finalPrice = priceFromXhr ?? priceFromDom;

    if (finalPrice && finalPrice > 0) {
      offers.push({
        insurerSlug: INSURER_SLUG,
        insurerName: INSURER_NAME,
        price:       finalPrice,
        currency:    'PEN',
        planName:    'SOAT Pacífico Digital Plus',
        extras:      ['Red médica preferencial de clínicas', 'Hasta 2 grúas anuales por siniestro', '200 CMR Puntos de bienvenida'],
        scrapedAt:   new Date().toISOString(),
        source:      page.url(),
        confidence:  priceFromXhr ? 'HIGH' : 'MEDIUM',
      });
      console.log(`  [Pacífico] ✅ S/ ${finalPrice}`);
    } else {
      await page.screenshot({ path: `tools/scraper/debug/pacifico-${Date.now()}.png`, fullPage: true });
      errors.push('Pacífico: No se pudo extraer precio. Screenshot guardado.');
    }

    logEndpoints(INSURER_SLUG, captured);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Pacífico: ${msg}`);
    console.error(`  [Pacífico] ❌ ${msg}`);
    await page.screenshot({ path: `tools/scraper/debug/pacifico-error-${Date.now()}.png` }).catch(() => {});
  } finally {
    await page.close();
  }

  return { offers, errors };
}

function extractPrice(captured: Array<{ url: string; body: unknown }>): number | null {
  const keys = ['precio', 'prima', 'monto', 'amount', 'tarifa', 'price', 'importe', 'total'];
  for (const { body, url } of captured) {
    if (typeof body !== 'object' || !body) continue;
    const price = deepSearch(body as Record<string, unknown>, keys);
    if (price && price > 10 && price < 5000) {
      console.log(`  [${INSURER_SLUG}] 📡 XHR: S/ ${price} (${url})`);
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

function logEndpoints(slug: string, captured: Array<{ url: string }>) {
  captured.filter(({ url }) => /tarif|cotiz|precio|prime|soat/i.test(url))
    .forEach(({ url }) => console.log(`  [${slug}] 📡 → ${url}`));
}

/**
 * scraper-mapfre.ts
 * Cotizador: https://www.mapfre.com.pe/seguros/autos/soat/
 */
import type { BrowserContext } from 'playwright';
import type { ScrapeInput, ScrapedOffer } from '../types';
import { newPage, humanDelay, humanType, interceptJsonResponses } from '../browser';

const INSURER_SLUG = 'mapfre';
const INSURER_NAME = 'MAPFRE';
const BASE_URL     = 'https://www.mapfre.com.pe/seguros/autos/soat/';

export async function scrapeMapfre(
  context: BrowserContext,
  input: ScrapeInput
): Promise<{ offers: ScrapedOffer[]; errors: string[] }> {
  const page    = await newPage(context, 35_000);
  const errors: string[] = [];
  const offers: ScrapedOffer[] = [];
  const captured = interceptJsonResponses(page);

  try {
    console.log(`  [MAPFRE] Navegando a ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await humanDelay(1500, 2500);

    // Cerrar cookies/modal
    await page.click('#acceptCookies, .cookie-accept, button:has-text("Aceptar")').catch(() => {});
    await humanDelay(500);

    // MAPFRE suele tener un botón "Cotizar SOAT" que abre el cotizador real
    const cotizarBtn = await page.$('a:has-text("Cotizar"), button:has-text("Cotiza"), a[href*="cotiza"]');
    if (cotizarBtn) {
      await cotizarBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await humanDelay(1500);
    }

    // ── Tipo de vehículo ──────────────────────────────────────────────────
    const vehicleMap: Record<string, string> = {
      AUTO: 'Automóvil', MOTO: 'Motocicleta', MOTOTAXI: 'Mototaxi',
      VAN: 'Camioneta', CARGO: 'Camión'
    };
    const label = vehicleMap[input.vehicleType] || 'Automóvil';
    console.log(`  [MAPFRE] Tipo: ${label}`);

    await page.click(
      `label:has-text("${label}"), button:has-text("${label}"), [data-vehicle*="${input.vehicleType}"]`
    ).catch(() => {});
    await humanDelay();

    // ── Placa ─────────────────────────────────────────────────────────────
    console.log(`  [MAPFRE] Placa: ${input.plate}`);
    const plateEl = await page.waitForSelector(
      'input[name*="placa"], input[placeholder*="laca"], input[id*="placa"]',
      { timeout: 10_000 }
    );
    await humanType(
      page,
      await plateEl.evaluate(el => '#' + (el.id || 'noId')),
      input.plate.replace('-', '')
    );
    await humanDelay();

    // ── Documento ─────────────────────────────────────────────────────────
    const docTypeEl = await page.$('select[name*="documento"], select[id*="tipoDoc"]');
    if (docTypeEl) {
      await docTypeEl.selectOption({ label: input.documentType }).catch(() => {});
      await humanDelay(300);
    }
    const docNumEl = await page.$('input[name*="numDoc"], input[id*="numDoc"], input[placeholder*="documento"]');
    if (docNumEl) {
      await humanType(page, await docNumEl.evaluate(el => '#' + (el.id || 'noId')), input.documentNumber);
      await humanDelay(300);
    }

    // ── Cotizar ────────────────────────────────────────────────────────────
    console.log(`  [MAPFRE] Cotizando...`);
    await Promise.all([
      page.waitForResponse(
        r => r.status() < 400 && /tarif|cotiz|precio|prima|quote/i.test(r.url()),
        { timeout: 20_000 }
      ).catch(() => null),
      page.click('button[type="submit"], button:has-text("Cotizar"), button:has-text("Calcular")'),
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
        planName:    'SOAT Conectado MAPFRE',
        extras:      ['Auxilio mecánico y cerrajería', 'Ambulancia 24 hrs en caso de emergencia', 'Descuentos exclusivos en talleres'],
        scrapedAt:   new Date().toISOString(),
        source:      page.url(),
        confidence:  priceFromXhr ? 'HIGH' : 'MEDIUM',
      });
      console.log(`  [MAPFRE] ✅ S/ ${finalPrice}`);
    } else {
      await page.screenshot({ path: `tools/scraper/debug/mapfre-${Date.now()}.png`, fullPage: true });
      errors.push('MAPFRE: No se pudo extraer precio. Screenshot guardado.');
    }

    logEndpoints(INSURER_SLUG, captured);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`MAPFRE: ${msg}`);
    console.error(`  [MAPFRE] ❌ ${msg}`);
    await page.screenshot({ path: `tools/scraper/debug/mapfre-error-${Date.now()}.png` }).catch(() => {});
  } finally {
    await page.close();
  }

  return { offers, errors };
}

function extractPrice(captured: Array<{ url: string; body: unknown }>): number | null {
  const keys = ['precio', 'prima', 'monto', 'amount', 'tarifa', 'price', 'importe', 'total', 'netPremium'];
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

function logEndpoints(slug: string, captured: Array<{ url: string; body: unknown }>) {
  captured.filter(({ url }) => /tarif|cotiz|precio|prime|soat|quote/i.test(url))
    .forEach(({ url }) => console.log(`  [${slug}] 📡 → ${url}`));
}

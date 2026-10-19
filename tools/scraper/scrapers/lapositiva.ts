/**
 * scraper-lapositiva.ts
 * Cotizador SOAT de La Positiva: https://comprar.lapositiva.com.pe/soat
 *
 * Estrategia:
 *  1. Navega al cotizador
 *  2. Selecciona tipo de vehículo
 *  3. Ingresa placa
 *  4. Captura respuesta XHR con precio
 */
import type { BrowserContext } from 'playwright';
import type { ScrapeInput, ScrapedOffer } from '../types';
import { newPage, humanDelay, humanType, interceptJsonResponses } from '../browser';

const INSURER_SLUG = 'la-positiva';
const INSURER_NAME = 'La Positiva';
const BASE_URL     = 'https://comprar.lapositiva.com.pe/segurosoat/';

const VEHICLE_TYPE_MAP: Record<string, string> = {
  AUTO:      'AUTOMOVIL',
  MOTO:      'MOTOCICLETA',
  MOTOTAXI:  'MOTOTAXI',
  VAN:       'CAMIONETA',
  CARGO:     'CAMION',
};

export async function scrapeLaPositiva(
  context: BrowserContext,
  input: ScrapeInput
): Promise<{ offers: ScrapedOffer[]; errors: string[] }> {
  const page   = await newPage(context, 35_000);
  const errors: string[] = [];
  const offers: ScrapedOffer[] = [];
  const captured = interceptJsonResponses(page);

  try {
    console.log(`  [La Positiva] Navegando a ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await humanDelay(1000, 2000);

    // ── Paso 1: Seleccionar tipo de vehículo ─────────────────────────────────
    const tipoVehiculo = VEHICLE_TYPE_MAP[input.vehicleType] || 'AUTOMOVIL';
    console.log(`  [La Positiva] Seleccionando tipo: ${tipoVehiculo}`);

    // Intentar selector de tipo de vehículo (puede ser select, radio o tab)
    const selectSelector = 'select[name*="tipo"], select[id*="tipo"], select[id*="vehicle"], select[name*="vehicle"]';
    const selectEl = await page.$(selectSelector);
    if (selectEl) {
      await selectEl.selectOption({ label: tipoVehiculo }).catch(() =>
        selectEl.selectOption({ value: tipoVehiculo }).catch(() => {})
      );
    } else {
      // Intentar con botones/tabs
      await page.click(`[data-tipo="${tipoVehiculo}"], [data-vehicle="${tipoVehiculo}"]`).catch(() => {});
    }
    await humanDelay();

    // ── Paso 2: Ingresar placa ─────────────────────────────────────────────
    console.log(`  [La Positiva] Ingresando placa: ${input.plate}`);
    const plateSelector = 'input[name*="placa"], input[id*="placa"], input[placeholder*="placa"], input[placeholder*="Placa"]';
    await page.waitForSelector(plateSelector, { timeout: 10_000 });
    await humanType(page, plateSelector, input.plate.replace('-', ''));
    await humanDelay();

    // ── Paso 3: Submit / Cotizar ─────────────────────────────────────────
    console.log(`  [La Positiva] Enviando formulario...`);
    const btnSelector = 'button[type="submit"], button:has-text("Cotizar"), button:has-text("COTIZAR"), a:has-text("Cotizar")';
    await Promise.all([
      page.waitForResponse(r => r.url().includes('tarif') || r.url().includes('cotiz') || r.url().includes('precio'), { timeout: 20_000 })
        .catch(() => null),
      page.click(btnSelector).catch(() => page.keyboard.press('Enter')),
    ]);
    await humanDelay(2000, 3000);

    // ── Paso 4: Extraer precio del DOM ────────────────────────────────────
    // Intentar extraer precio del HTML resultante
    const priceText = await page.evaluate(() => {
      const pricePatterns = [
        '[class*="precio"]', '[class*="price"]', '[class*="monto"]',
        '[class*="tarifa"]', '[data-precio]', '.precio', '.price',
        'span:has-text("S/")', 'p:has-text("S/")'
      ];
      for (const sel of pricePatterns) {
        const el = document.querySelector(sel);
        if (el?.textContent?.match(/\d+[\.,]\d{2}/)) return el.textContent;
      }
      // Buscar en todo el texto de la página
      const allText = document.body.innerText;
      const match = allText.match(/S\/?\s*\.?\s*(\d{2,4}[\.,]\d{2})/);
      return match ? match[0] : null;
    }).catch(() => null);

    // ── Paso 5: Extraer de respuestas XHR capturadas ─────────────────────
    const priceFromXhr = extractPriceFromCaptures(captured);

    const finalPrice = priceFromXhr ?? parsePrice(priceText ?? '');

    if (finalPrice && finalPrice > 0) {
      offers.push({
        insurerSlug: INSURER_SLUG,
        insurerName: INSURER_NAME,
        price:       finalPrice,
        currency:    'PEN',
        planName:    'SOAT Digital Tradicional',
        extras:      ['Auxilio de batería 24/7', 'Grúa en ciudad (1 evento)', 'Atención médica legal inmediata'],
        scrapedAt:   new Date().toISOString(),
        source:      BASE_URL,
        confidence:  priceFromXhr ? 'HIGH' : 'MEDIUM',
      });
      console.log(`  [La Positiva] ✅ Precio obtenido: S/ ${finalPrice} (confianza: ${priceFromXhr ? 'HIGH' : 'MEDIUM'})`);
    } else {
      // Tomar screenshot para diagnóstico
      await page.screenshot({ path: `tools/scraper/debug/la-positiva-${Date.now()}.png`, fullPage: true });
      errors.push(`La Positiva: No se pudo extraer precio. Screenshot guardado para diagnóstico.`);
      console.warn(`  [La Positiva] ⚠️  No se extrajo precio. Ver screenshot en tools/scraper/debug/`);
    }

    // Guardar endpoints descubiertos
    logDiscoveredEndpoints(INSURER_SLUG, captured);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`La Positiva: ${msg}`);
    console.error(`  [La Positiva] ❌ Error: ${msg}`);
    await page.screenshot({ path: `tools/scraper/debug/la-positiva-error-${Date.now()}.png` }).catch(() => {});
  } finally {
    await page.close();
  }

  return { offers, errors };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractPriceFromCaptures(
  captured: Array<{ url: string; body: unknown; status: number }>
): number | null {
  const priceKeys = ['precio', 'prime', 'monto', 'amount', 'total', 'tarifa', 'price', 'importe', 'prima'];

  for (const { body } of captured) {
    if (typeof body !== 'object' || !body) continue;
    const price = deepSearch(body, priceKeys);
    if (price && price > 10 && price < 5000) return price;
  }
  return null;
}

function deepSearch(obj: unknown, keys: string[], depth = 0): number | null {
  if (depth > 6 || typeof obj !== 'object' || !obj) return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (keys.some(key => k.toLowerCase().includes(key))) {
      const n = Number(v);
      if (!isNaN(n) && n > 10) return n;
    }
    if (typeof v === 'object') {
      const found = deepSearch(v, keys, depth + 1);
      if (found) return found;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        const found = deepSearch(item, keys, depth + 1);
        if (found) return found;
      }
    }
  }
  return null;
}

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return !isNaN(n) && n > 0 ? n : null;
}

function logDiscoveredEndpoints(slug: string, captured: Array<{ url: string; body: unknown }>) {
  const interesting = captured.filter(({ url, body }) =>
    (url.includes('tarif') || url.includes('cotiz') || url.includes('precio') || url.includes('prime'))
    && typeof body === 'object'
  );
  if (interesting.length > 0) {
    console.log(`  [${slug}] 📡 Endpoints XHR interesantes detectados:`);
    interesting.forEach(({ url }) => console.log(`    → ${url}`));
  }
}

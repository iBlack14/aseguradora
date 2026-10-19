/**
 * scraper-protecta.ts
 * Cotizador: https://www.protectasecurity.pe/soat
 */
import type { BrowserContext } from 'playwright';
import type { ScrapeInput, ScrapedOffer } from '../types';
import { newPage, humanDelay, humanType, interceptJsonResponses } from '../browser';

const INSURER_SLUG = 'protecta';
const INSURER_NAME = 'Protecta Security';
const BASE_URL     = 'https://www.protectasecurity.pe/soat';

export async function scrapeProtecta(
  context: BrowserContext,
  input: ScrapeInput
): Promise<{ offers: ScrapedOffer[]; errors: string[] }> {
  const page    = await newPage(context, 35_000);
  const errors: string[] = [];
  const offers: ScrapedOffer[] = [];
  const captured = interceptJsonResponses(page);

  try {
    console.log(`  [Protecta] Navegando a ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await humanDelay(1500, 2500);

    // Cerrar popups
    await page.click('[class*="modal"] [class*="close"], .modal-close, button:has-text("×")').catch(() => {});
    await humanDelay(500);

    // ── Tipo de vehículo ──────────────────────────────────────────────────
    const vehicleMap: Record<string, string[]> = {
      AUTO:     ['Auto', 'Automóvil', 'AUTOMOVIL'],
      MOTO:     ['Moto', 'Motocicleta', 'MOTOCICLETA'],
      MOTOTAXI: ['Mototaxi', 'MOTOTAXI', 'Trimoto'],
      VAN:      ['Camioneta', 'Van', 'CAMIONETA'],
      CARGO:    ['Camión', 'Carga', 'CARGO'],
    };
    const labels = vehicleMap[input.vehicleType] || ['Auto'];
    console.log(`  [Protecta] Seleccionando vehículo: ${labels[0]}`);

    for (const label of labels) {
      const clicked = await page.click(
        `button:has-text("${label}"), [data-type*="${label.toUpperCase()}"], ` +
        `label:has-text("${label}"), .tipo-vehiculo:has-text("${label}")`
      ).then(() => true).catch(() => false);
      if (clicked) break;
    }
    await humanDelay();

    // ── Placa ─────────────────────────────────────────────────────────────
    console.log(`  [Protecta] Ingresando placa: ${input.plate}`);
    const plateEl = await page.waitForSelector(
      'input[name*="placa"], input[placeholder*="laca"], input[id*="placa"], input[id*="PLACA"]',
      { timeout: 10_000 }
    );
    const plateId = await plateEl.evaluate(el => '#' + el.id || el.tagName);
    await humanType(page, plateId, input.plate.replace('-', ''));
    await humanDelay();

    // ── Departamento ──────────────────────────────────────────────────────
    const deptSel = 'select[name*="depart"], select[id*="depart"], select[name*="region"]';
    const deptEl = await page.$(deptSel);
    if (deptEl) {
      await deptEl.selectOption({ label: input.department }).catch(() =>
        deptEl.selectOption({ value: input.department.toUpperCase() }).catch(() => {})
      );
      await humanDelay();
    }

    // ── Cotizar ────────────────────────────────────────────────────────────
    console.log(`  [Protecta] Enviando formulario...`);
    await Promise.all([
      page.waitForResponse(
        r => r.status() < 400 && /tarif|cotiz|precio|prima|soat/i.test(r.url()),
        { timeout: 20_000 }
      ).catch(() => null),
      page.click('button[type="submit"], button:has-text("Cotizar"), button:has-text("Calcular precio")'),
    ]);
    await humanDelay(2000, 4000);

    // ── Extraer precio ─────────────────────────────────────────────────────
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
        planName:    'SOAT Protecta Flex',
        extras:      ['Asistencia telefónica 24 horas', 'Atención directa ante la SBS', 'Certificado digital verificable'],
        scrapedAt:   new Date().toISOString(),
        source:      page.url(),
        confidence:  priceFromXhr ? 'HIGH' : 'MEDIUM',
      });
      console.log(`  [Protecta] ✅ S/ ${finalPrice}`);
    } else {
      await page.screenshot({ path: `tools/scraper/debug/protecta-${Date.now()}.png`, fullPage: true });
      errors.push('Protecta: No se pudo extraer precio. Screenshot guardado.');
    }

    logEndpoints(INSURER_SLUG, captured);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Protecta: ${msg}`);
    console.error(`  [Protecta] ❌ ${msg}`);
    await page.screenshot({ path: `tools/scraper/debug/protecta-error-${Date.now()}.png` }).catch(() => {});
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
      console.log(`  [${INSURER_SLUG}] 📡 XHR precio: S/ ${price} (${url})`);
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
  captured.filter(({ url }) => /tarif|cotiz|precio|prime|soat/i.test(url))
    .forEach(({ url }) => console.log(`  [${slug}] 📡 → ${url}`));
}

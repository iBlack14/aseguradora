/**
 * browser.ts — Fábrica de browser con stealth mode
 * Evita detección de bot por Cloudflare y CAPTCHA básicos.
 */
import { chromium, Browser, BrowserContext, Page, ElementHandle } from 'playwright';

export interface BrowserOptions {
  headless?: boolean;   // false = ventana visible (útil para debug)
  slowMo?:  number;     // ms entre acciones (simula usuario real)
  timeout?: number;     // timeout por acción en ms
  proxy?:   string;     // 'http://user:pass@host:port'
}

export async function createBrowser(opts: BrowserOptions = {}): Promise<Browser> {
  const { headless = true, slowMo = 80, proxy } = opts;

  return chromium.launch({
    headless,
    slowMo,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    ...(proxy ? { proxy: { server: proxy } } : {}),
  });
}

export async function createContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    extraHTTPHeaders: {
      'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
    },
  });

  // Evadir detección básica de headless
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['es-PE', 'es'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    // @ts-ignore
    window.chrome = { runtime: {} };
  });

  return context;
}

export async function newPage(context: BrowserContext, timeout = 30_000): Promise<Page> {
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);
  return page;
}

/** Espera aleatoria entre min y max ms (simula comportamiento humano) */
export function humanDelay(min = 500, max = 1500): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(r => setTimeout(r, ms));
}

/** Tipo en un campo como si fuera humano (letra por letra) */
export async function humanType(page: Page, target: string | ElementHandle, text: string) {
  if (typeof target === 'string') {
    await page.click(target);
    await page.fill(target, '');
    for (const char of text) {
      await page.keyboard.type(char, { delay: 40 + Math.random() * 60 });
    }
  } else {
    await target.click();
    await target.fill('');
    for (const char of text) {
      await page.keyboard.type(char, { delay: 40 + Math.random() * 60 });
    }
  }
}

/** Captura todas las respuestas JSON de la página durante scraping */
export function interceptJsonResponses(page: Page): Array<{ url: string; body: unknown; status: number }> {
  const captured: Array<{ url: string; body: unknown; status: number }> = [];

  page.on('response', async (response) => {
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('json') && !contentType.includes('javascript')) return;
    try {
      const text = await response.text();
      if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) return;
      const body = JSON.parse(text);
      captured.push({ url: response.url(), body, status: response.status() });
    } catch {
      // silenciar errores de parseo
    }
  });

  return captured;
}

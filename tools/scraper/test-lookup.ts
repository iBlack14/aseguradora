import { createBrowser, newPage, humanDelay, humanType, interceptJsonResponses } from './browser';

async function main() {
  const plate = process.argv[2] || 'AMY-477';
  console.log(`Testing vehicle lookup for plate: ${plate}`);
  const browser = await createBrowser({ headless: true });
  const context = await browser.newContext();
  const page = await newPage(context, 40000);
  const captured = interceptJsonResponses(page);

  try {
    await page.goto('https://www.interseguro.pe/soat-digital/', { waitUntil: 'domcontentloaded' });
    await humanDelay(1500, 2000);

    const plateInput = await page.waitForSelector('input[name*="placa" i], input[placeholder*="placa" i], input[type="text"]', { timeout: 15000 });
    await humanType(page, plateInput, plate.replace(/[^A-Z0-9]/gi, ''));
    await humanDelay(500, 1000);

    const submitBtn = page.locator('button:visible').filter({ hasText: /cotizar/i }).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
    } else {
      await plateInput.press('Enter');
    }

    await humanDelay(4000, 6000);

    console.log(`--- Captured ${captured.length} JSON responses ---`);
    for (const c of captured) {
      const s = JSON.stringify(c.body);
      if (s.toLowerCase().includes('bmw') || s.toLowerCase().includes('marca') || s.toLowerCase().includes('modelo') || s.toLowerCase().includes('vehic') || s.toLowerCase().includes('chasis') || s.toLowerCase().includes('vin') || s.toLowerCase().includes('placa')) {
        console.log(`\nURL: ${c.url}`);
        console.log(`STATUS: ${c.status}`);
        console.log(`BODY:`, JSON.stringify(c.body, null, 2));
      }
    }

    console.log('\nPage URL:', page.url());
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

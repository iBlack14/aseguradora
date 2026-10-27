import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Keep the captured HTML editable, with the original styles and local assets.
export const dynamic = 'force-static';

export async function GET() {
  const html = await readFile(path.join(process.cwd(), 'reference', 'page.html'), 'utf8');
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

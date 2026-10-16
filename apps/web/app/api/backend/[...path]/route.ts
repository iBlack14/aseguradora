import { NextRequest, NextResponse } from 'next/server';

const apiBaseUrl = () => process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  if (segments[0] !== 'v1' || segments.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment))) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  const path = segments.join('/');
  const allowed =
    (request.method === 'GET' && (/^v1\/vehicles\/[^/]+$/.test(path) || path === 'v1/offers' || path === 'v1/insurers')) ||
    (request.method === 'POST' && path === 'v1/quotes');
  if (!allowed) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const target = new URL(path, `${apiBaseUrl().replace(/\/$/, '')}/`);
  target.search = request.nextUrl.search;

  const body = request.method === 'POST' ? await request.arrayBuffer() : undefined;
  try {
    const response = await fetch(target, {
      method: request.method,
      headers: { 'content-type': request.headers.get('content-type') || 'application/json' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000)
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' }
    });
  } catch {
    return NextResponse.json({ error: 'API_UNAVAILABLE' }, { status: 503 });
  }
}

export const dynamic = 'force-dynamic';
export const GET = proxy;
export const POST = proxy;

import { NextRequest, NextResponse } from 'next/server';

const apiBaseUrl = () => process.env.API_INTERNAL_URL || process.env.API_URL || 'http://127.0.0.1:4000';

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  if (!segments || segments[0] !== 'v1' || segments.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment))) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  const path = segments.join('/');
  const target = new URL(path, `${apiBaseUrl().replace(/\/$/, '')}/`);
  target.search = request.nextUrl.search;

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  try {
    const headers: Record<string, string> = {};
    const ct = request.headers.get('content-type');
    if (ct) headers['content-type'] = ct;

    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000)
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' }
    });
  } catch (err) {
    console.error(`[Web Proxy] Error connecting to API target ${target.toString()}:`, err);
    return NextResponse.json({ error: 'API_UNAVAILABLE', target: target.toString() }, { status: 503 });
  }
}

export const dynamic = 'force-dynamic';
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;

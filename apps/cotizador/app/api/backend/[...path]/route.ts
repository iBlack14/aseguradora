import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.API_URL || 'http://localhost:4000';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = `${apiUrl}/${path.join('/')}${request.nextUrl.search}`;
  const response = await fetch(target, { method: request.method, headers: request.headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text() });
  return new NextResponse(response.body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json' } });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;

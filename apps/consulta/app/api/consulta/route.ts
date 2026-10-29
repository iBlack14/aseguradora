import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const plate = request.nextUrl.searchParams.get('plate') || '';
  if (!/^[a-zA-Z0-9-]{6,9}$/.test(plate)) return NextResponse.json({ message: 'Ingresa una placa valida.' }, { status: 400 });
  const base = process.env.API_INTERNAL_URL || process.env.API_URL || 'http://127.0.0.1:4000';
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/v1/soat/consulta?${new URLSearchParams({ plate })}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    return new NextResponse(response.body, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ message: 'La consulta no esta disponible. Intentalo nuevamente.' }, { status: 503 });
  }
}

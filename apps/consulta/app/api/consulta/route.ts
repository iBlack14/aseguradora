import { NextRequest, NextResponse } from 'next/server';
import { captchaCookie, verifyCaptcha } from '../../../lib/captcha';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!verifyCaptcha(request.cookies.get(captchaCookie)?.value, body?.captcha)) {
    return NextResponse.json({ message: 'El codigo de verificacion es incorrecto o vencio. Ingresa el nuevo codigo.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const plate = typeof body?.plate === 'string' ? body.plate : '';
  if (!/^[a-zA-Z0-9-]{6,9}$/.test(plate)) return NextResponse.json({ message: 'Ingresa una placa valida.' }, { status: 400 });
  const base = process.env.API_INTERNAL_URL || process.env.API_URL || 'http://127.0.0.1:4000';
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/v1/soat/consulta?${new URLSearchParams({ plate })}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    return new NextResponse(response.body, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ message: 'La consulta no esta disponible. Intentalo nuevamente.' }, { status: 503 });
  }
}

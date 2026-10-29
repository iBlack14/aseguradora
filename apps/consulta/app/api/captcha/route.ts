import { NextRequest, NextResponse } from 'next/server';
import { captchaCookie, createCaptcha } from '../../../lib/captcha';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const challenge = createCaptcha(request.cookies.get(captchaCookie)?.value);
  if (!challenge) return NextResponse.json({ message: 'Intenta nuevamente en unos minutos.' }, { status: 429 });
  const response = new NextResponse(challenge.svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  response.cookies.set(captchaCookie, challenge.id, { httpOnly: true, sameSite: 'strict', secure: request.nextUrl.protocol === 'https:', maxAge: 300, path: '/api' });
  return response;
}

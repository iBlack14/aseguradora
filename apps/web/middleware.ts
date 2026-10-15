import {NextRequest, NextResponse} from 'next/server';

const stitchRoutes: Record<string, string> = {
  '/': '/stitch/index.html',
  '/resultados': '/stitch/resultados.html',
  '/comparar': '/stitch/comparador.html',
  '/pago': '/stitch/pago.html',
};

export function middleware(request: NextRequest) {
  const target = stitchRoutes[request.nextUrl.pathname];
  if (!target) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = target;
  return NextResponse.rewrite(url);
}

export const config = {matcher: ['/', '/resultados', '/comparar', '/pago']};

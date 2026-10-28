import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionRole, validSession } from './lib/session';
import { publicUrl } from './lib/publicUrl';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow API routes to be handled directly by their route handlers without redirecting to login HTML
  if (path.startsWith('/api/')) {
    return NextResponse.next();
  }

  const authenticated = await validSession(request.cookies.get(SESSION_COOKIE)?.value);
  const role = await sessionRole(request.cookies.get(SESSION_COOKIE)?.value);
  if (path === '/login') {
    if (authenticated) return NextResponse.redirect(publicUrl(request, '/'));
    return NextResponse.next();
  }

  if (!authenticated) {
    const login = publicUrl(request, '/login');
    login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }
  if (path === '/usuarios' && role !== 'ADMIN') return NextResponse.redirect(publicUrl(request, '/'));

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/cotizaciones', '/registro-apeseg', '/configuracion', '/usuarios', '/login']
};


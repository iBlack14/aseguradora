import { NextRequest } from 'next/server';

/** Builds redirects using the public host preserved by Easypanel's reverse proxy. */
export function publicUrl(request: NextRequest, path: string) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  if (forwardedHost) return new URL(path, `${forwardedProto || 'https'}://${forwardedHost}`);
  return new URL(path, request.url);
}

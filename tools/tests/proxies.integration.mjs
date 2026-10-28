import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const secret = 'proxy-integration-test-secret';
function cookie(role) {
  const payload = `${Date.now() + 60000}:${role}:CORPORATE`;
  return `falabella_admin_session=${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
for (const app of ['web', 'cotizador', 'admin']) {
  test(`${app}: proxy rejects private and unauthorized requests`, async () => {
    const port = 16000 + Math.floor(Math.random() * 2000);
    const base = `http://localhost:${port}`;
    const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port)], {
      cwd: path.join(root, 'apps', app), stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production', AUTH_SECRET: secret, ADMIN_API_KEY: 'test-key', API_URL: 'http://127.0.0.1:1', API_INTERNAL_URL: 'http://127.0.0.1:1' }
    });
    let logs = '';
    child.stdout.on('data', chunk => { logs += chunk; });
    child.stderr.on('data', chunk => { logs += chunk; });
    const request = (url, method = 'GET', headers = {}) => fetch(`${base}/api/backend${url}`, { method, headers });
    try {
      let ready = false;
      for (let i = 0; i < 150; i++) {
        try { const res = await request('/v1/quotes'); if (res.status === (app === 'admin' ? 401 : 403)) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.ok(ready, 'production server started: ' + logs);
      if (app !== 'admin') {
        for (const [url, method] of [['/v1/quotes','GET'], ['/v1/admin/users','GET'], ['/v1/admin/tariffs','POST'], ['/v1/quotes/test/emit','POST'], ['/v1/quotes/test','DELETE']]) {
          assert.equal((await request(url, method, { 'x-admin-key': 'test-key', 'x-admin-role': 'ADMIN' })).status, 403);
        }
        assert.equal((await request('/v1/payment-config')).status, 503, 'public route reaches upstream error handling');
      } else {
        assert.equal((await request('/v1/admin/users')).status, 401);
        assert.equal((await request('/v1/quotes', 'GET', { cookie: 'falabella_admin_session=invalid' })).status, 401);
        assert.equal((await request('/v1/admin/users', 'GET', { cookie: cookie('SALES') })).status, 403);
        assert.equal((await request('/v1/quotes/test', 'DELETE', { cookie: cookie('AUDITOR'), origin: base })).status, 403);
        assert.equal((await request('/v1/admin/tariffs', 'POST', { cookie: cookie('ADMIN'), origin: 'https://other.example' })).status, 403);
        assert.equal((await request('/v1/quotes', 'GET', { cookie: cookie('ADMIN') })).status, 503, 'authenticated request reaches upstream');
      }
    } finally {
      child.kill();
      await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
    }
  });
}

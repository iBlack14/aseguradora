import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('API access control, disabled issuance and validated writes', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'insurance-test-'));
  const port = 14000 + Math.floor(Math.random() * 1000);
  const env = { ...process.env, NODE_ENV: 'test', API_PORT: String(port), DATABASE_URL: '', ADMIN_API_KEY: 'integration-test-key', DEMO_MODE: 'false', RATE_LIMIT_MAX: '1000' };
  const child = spawn(process.execPath, [path.join(root, 'apps/api/dist/server.js')], { cwd, env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  const admin = { 'x-admin-key': env.ADMIN_API_KEY, 'x-admin-role': 'ADMIN' };
  const request = (url, method = 'GET', headers = {}, body) => fetch(base + url, { method, headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await request('/health')).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'API started');
    for (const [url, method] of [['/v1/quotes','GET'], ['/v1/quotes/test','GET'], ['/v1/quotes/test','DELETE'], ['/v1/quotes/test/annul','POST'], ['/v1/quotes/test/emit','POST'], ['/v1/admin/tariffs','POST'], ['/v1/admin/payment-config','PUT'], ['/v1/admin/users','GET'], ['/v1/admin/tariffs/sync-scraper','POST']]) {
      assert.equal((await request(url, method)).status, 401, `${method} ${url} requires internal credentials`);
    }
    assert.equal((await request('/v1/quotes', 'GET', { ...admin, 'x-admin-key': 'wrong' })).status, 401);
    assert.equal((await request('/v1/quotes', 'GET', { 'x-admin-key': env.ADMIN_API_KEY })).status, 403);
    assert.equal((await request('/v1/quotes', 'GET', admin)).status, 200);
    const auditor = { ...admin, 'x-admin-role': 'AUDITOR' };
    assert.equal((await request('/v1/quotes', 'GET', auditor)).status, 200);
    assert.equal((await request('/v1/quotes/test', 'DELETE', auditor)).status, 403);
    assert.equal((await request('/v1/admin/users', 'GET', { ...admin, 'x-admin-role': 'SALES' })).status, 403);
    assert.equal((await request('/v1/quotes', 'POST', {}, { source: 'MANUAL' })).status, 403);
    assert.equal((await request('/v1/quotes/test/emit', 'POST', admin)).status, 501);
    assert.equal((await request('/v1/orders', 'POST', admin)).status, 501);
    assert.equal((await request('/v1/offers?vehicleType=AUTO')).status, 200);
    assert.equal((await request('/v1/payment-config')).status, 200);
    assert.equal((await request('/v1/admin/tariffs', 'POST', admin, { insurerSlug: 'mapfre', annualPrice: -1 })).status, 400);
    assert.equal((await request('/v1/admin/tariffs', 'POST', admin, { insurerSlug: 'mapfre', annualPrice: 98 })).status, 200);
    const tariffs = await (await request('/v1/tariffs', 'GET', admin)).json();
    assert.equal(tariffs.tariffs.find(t => t.insurerSlug === 'mapfre').annualPrice, 98);
    assert.deepEqual((await (await request('/v1/quotes', 'GET', admin)).json()).data, [], 'disabled issuance did not create records');
    const response = await request('/v1/quotes', 'POST', {}, {
      plate: 'ABC123', vehicleType: 'AUTO', department: 'Lima', documentType: 'DNI',
      documentNumber: '12345678', startsAt: '2026-11-01', selectedOfferId: 'mapfre', selectedPrice: 0.01
    });
    assert.equal(response.status, 201, 'public quoting remains available');
    const quote = (await response.json()).data;
    assert.equal(quote.selectedPrice, 98, 'public callers cannot replace the server price');
    assert.equal((await request(`/v1/quotes/${quote.id}/emit`, 'POST', admin)).status, 501);
    assert.equal((await (await request(`/v1/quotes/${quote.id}`, 'GET', admin)).json()).data.status, 'NUEVA');

  } finally {
    child.kill();
    await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
    await rm(cwd, { recursive: true, force: true });
  }
});

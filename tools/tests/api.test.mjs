import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('API access control, manual sales issuance and validated writes', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'insurance-test-'));
  const port = 14000 + Math.floor(Math.random() * 1000);
  const env = { ...process.env, NODE_ENV: 'test', API_PORT: String(port), DATABASE_URL: '', ADMIN_API_KEY: 'integration-test-key', DEMO_MODE: 'false', RATE_LIMIT_MAX: '1000' };
  const child = spawn(process.execPath, [path.join(root, 'apps/api/dist/server.js')], { cwd, env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  const admin = { 'x-admin-key': env.ADMIN_API_KEY, 'x-admin-role': 'ADMIN' };
  const request = (url, method = 'GET', headers = {}, body) => fetch(base + url, { method, headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    let ready = false;
    for (let i = 0; i < 600; i++) {
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
    assert.equal((await request('/v1/quotes/test/emit', 'POST', admin)).status, 400);
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
    assert.equal((await request(`/v1/quotes/${quote.id}/emit`, 'POST', admin)).status, 400);
    assert.equal((await (await request(`/v1/quotes/${quote.id}`, 'GET', admin)).json()).data.status, 'NUEVA');
    const sales = { ...admin, 'x-admin-role': 'SALES' };
    const issuance = {
      paymentConfirmed: true, paymentReference: 'OPERACION-123', holderName: 'Cliente Prueba',
      selectedOfferId: 'mapfre', realPrice: 98, paymentMethod: 'CASH',
      vehicle: { brand: 'Suzuki', model: 'GSX-R 150', year: 2026, use: 'PARTICULAR', department: 'Lima' }
    };
    const emitUrl = `/v1/quotes/${quote.id}/emit`;
    assert.equal((await request(emitUrl, 'POST', {}, issuance)).status, 401);
    assert.equal((await request(emitUrl, 'POST', auditor, issuance)).status, 403);
    for (const invalid of [{ paymentConfirmed: false }, { paymentReference: '' }, { paymentMethod: 'INSTALLMENTS' }, { realPrice: -1 }]) {
      assert.equal((await request(emitUrl, 'POST', sales, { ...issuance, ...invalid })).status, 400);
    }
    assert.equal((await request(emitUrl, 'POST', sales, { ...issuance, selectedOfferId: 'unknown' })).status, 400);
    const competing = await Promise.all([request(emitUrl, 'POST', sales, issuance), request(emitUrl, 'POST', sales, issuance)]);
    assert.deepEqual(competing.map(response => response.status).sort(), [200, 409], 'simultaneous requests issue a quote only once');
    const emitted = (await (await request(`/v1/quotes/${quote.id}`, 'GET', sales)).json()).data;
    assert.equal(emitted.status, 'EMITIDA');
    assert.equal(emitted.policyNumber, '120605000-0');
    assert.equal(emitted.paymentReference, issuance.paymentReference);
    assert.equal((await request(emitUrl, 'POST', sales, issuance)).status, 409);
    const manualResponse = await request('/v1/quotes', 'POST', sales, { plate: 'XYZ789', vehicleType: 'AUTO', department: 'Lima', documentType: 'DNI', documentNumber: '87654321', startsAt: '2026-11-01', selectedOfferId: 'mapfre', source: 'MANUAL' });
    assert.equal(manualResponse.status, 201);
    const manual = (await manualResponse.json()).data;
    assert.equal(manual.source, 'MANUAL');
    const manualEmission = await request(`/v1/quotes/${manual.id}/emit`, 'POST', sales, { ...issuance, policyNumber: 'CLIENT-CANNOT-CHOOSE', paymentMethod: 'INSTALLMENTS', installmentCount: 2, installmentAmount: 49 });
    assert.equal(manualEmission.status, 200);
    const manualIssued = (await manualEmission.json()).data;
    assert.equal(manualIssued.installmentCount, 2);
    assert.equal(manualIssued.policyNumber, '120605001-0');
    assert.equal((await request(`/v1/quotes/${manual.id}/annul`, 'POST', sales)).status, 200);
    const consultation = await (await request(`/v1/soat/consulta?plate=${manual.plate}`, 'GET', {})).json();
    const annulledPolicy = consultation.data.history.find(record => record.policyNumber === '120605001-0');
    assert.equal(annulledPolicy.status, 'ANULADO', 'annulled sales remain publicly searchable');

    assert.equal((await request(`/v1/quotes/${manual.id}/emit`, 'POST', sales, issuance)).status, 409);
    assert.equal((await (await request(`/v1/quotes/${manual.id}`, 'GET', sales)).json()).data.policyNumber, '120605001-0', 'annulment retains the number');

    await request('/v1/admin/tariffs', 'POST', admin, { insurerSlug: 'pacifico', annualPrice: 98 });
    const newQuotes = await Promise.all(Array.from({ length: 6 }, async (_, index) => {
      const selectedOfferId = index % 2 ? 'mapfre' : 'pacifico';
      const response = await request('/v1/quotes', 'POST', sales, { plate: `TST00${index}`, vehicleType: 'AUTO', department: 'Lima', documentType: 'DNI', documentNumber: `7000000${index}`, startsAt: '2026-11-01', selectedOfferId, source: 'MANUAL' });
      assert.equal(response.status, 201);
      return { ...(await response.json()).data, selectedOfferId };
    }));
    const parallel = await Promise.all(newQuotes.map(async item => {
      const response = await request(`/v1/quotes/${item.id}/emit`, 'POST', sales, { ...issuance, selectedOfferId: item.selectedOfferId });
      assert.equal(response.status, 200);
      return (await response.json()).data.policyNumber;
    }));
    assert.equal(new Set(parallel).size, 6, 'parallel sales across insurers use distinct numbers');
    assert.deepEqual(parallel.sort(), Array.from({ length: 6 }, (_, i) => `${120605002 + i}-0`));

  } finally {
    child.kill();
    await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
    await rm(cwd, { recursive: true, force: true });
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('Manual SOAT registry: authorization, validation, editing and durable storage', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'soat-registry-test-'));
  const port = 18000 + Math.floor(Math.random() * 1000);
  const env = { ...process.env, NODE_ENV: 'test', API_PORT: String(port), DATABASE_URL: '', ADMIN_API_KEY: 'registry-test-key', DEMO_MODE: 'false', RATE_LIMIT_MAX: '1000' };
  const base = `http://127.0.0.1:${port}`;
  const auth = { 'x-admin-key': env.ADMIN_API_KEY, 'x-admin-role': 'ADMIN' };
  let child;
  const request = (url, method = 'GET', body, headers = auth) => fetch(base + url, { method, headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  async function start() {
    child = spawn(process.execPath, [path.join(root, 'apps/api/dist/server.js')], { cwd, env, stdio: 'ignore' });
    for (let count = 0; count < 100; count++) {
      try { if ((await request('/health')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('API did not start');
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const done = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await done;
  }
  const certificate = {
    Placa: 'ABC-123', NombreCompania: 'Aseguradora de prueba', NumeroPoliza: '0000012345',
    FechaInicio: '2020-01-01', FechaFin: '2099-01-01', Estado: 'VIGENTE',
    NombreUsoVehiculo: 'PARTICULAR', NombreClaseVehiculo: 'AUTOMOVIL', TipoCertificado: 'DIGITAL',
    Marca: 'Marca de prueba', NombreContratante: 'Titular de prueba', NumeroAsientos: 5
  };
  try {
    await start();
    assert.equal((await request('/v1/soat-registry', 'GET', undefined, {})).status, 401);
    assert.equal((await request('/v1/soat-registry', 'POST', certificate, { ...auth, 'x-admin-role': 'AUDITOR' })).status, 403);
    assert.equal((await request('/v1/soat-registry', 'POST', { ...certificate, FechaFin: '2019-01-01' })).status, 400);
    assert.equal((await request('/v1/soat-registry', 'POST', { ...certificate, FechaInicio: '2025-02-30' })).status, 400);
    assert.equal((await request('/v1/soat-registry', 'POST', { ...certificate, NumeroAsientos: 0 })).status, 400);
    assert.equal((await request('/v1/soat-registry', 'POST', { ...certificate, Estado: 'ANULADO' })).status, 400);
    assert.equal((await request('/v1/soat-registry', 'POST', { ...certificate, FechaAnulacion: '2026-10-01' })).status, 400);
    const created = await request('/v1/soat-registry', 'POST', certificate, { ...auth, 'x-admin-role': 'SALES' });
    assert.equal(created.status, 201);
    const record = (await created.json()).data;
    assert.equal(record.Placa, 'ABC123');
    assert.equal(record.NumeroPoliza, '0000012345');
    assert.equal(record.Estado, 'VIGENTE');
    assert.equal(record.source, 'INTERNAL_REGISTER');
    assert.equal((await request('/v1/soat-registry', 'POST', certificate)).status, 409);
    const update = await request(`/v1/soat-registry/${record.id}`, 'PUT', { ...certificate, Marca: '', NombreContratante: '', Estado: 'ANULADO', FechaAnulacion: '2026-10-01' });
    assert.equal(update.status, 200);
    const updated = (await update.json()).data;
    assert.equal(updated.Marca, null);
    assert.equal(updated.NombreContratante, null);
    assert.equal(updated.Estado, 'ANULADO');
    assert.equal((await request('/v1/soat-registry/missing', 'PUT', certificate)).status, 404);
    const readOnly = await request('/v1/soat-registry?plate=ABC-123', 'GET', undefined, { ...auth, 'x-admin-role': 'SUPPORT' });
    assert.equal(readOnly.status, 200);
    assert.equal((await readOnly.json()).total, 1);
    await stop(); await start();
    const persisted = await (await request('/v1/soat-registry?plate=ABC123')).json();
    assert.equal(persisted.total, 1, 'record survives an API restart');
    assert.equal(persisted.data[0].id, record.id);
    assert.equal(persisted.data[0].Estado, 'ANULADO');
    assert.equal((await (await request('/v1/soat-registry?plate=ZZZ')).json()).total, 0);
  } finally {
    await stop();
    assert.ok(path.resolve(cwd).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(cwd, { recursive: true, force: true });
  }
});

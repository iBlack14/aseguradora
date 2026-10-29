import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { reserveLocalPolicyNumber } from '../../apps/api/dist/policy-number.js';

test('policy reservations survive process restarts and never reset corrupt journals', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'policy-sequence-'));
  try {
    assert.equal(reserveLocalPolicyNumber(directory), '120605000-0');
    const moduleUrl = new URL('../../apps/api/dist/policy-number.js', import.meta.url).href;
    const script = `import { reserveLocalPolicyNumber } from ${JSON.stringify(moduleUrl)}; console.log(reserveLocalPolicyNumber(process.argv[1]));`;
    const next = execFileSync(process.execPath, ['--input-type=module', '-e', script, directory], { encoding: 'utf8' }).trim();
    assert.equal(next, '120605001-0');
    assert.equal(reserveLocalPolicyNumber(directory), '120605002-0');
    await writeFile(path.join(directory, 'policy-numbers.log'), 'broken\n');
    assert.throws(() => reserveLocalPolicyNumber(directory), /POLICY_COUNTER_CORRUPT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

import fs from 'node:fs';
import path from 'node:path';

// Development uses a durable reservation journal. PostgreSQL uses a sequence.
// A failed sale may leave a gap; a reserved number must never be reused.
export function reserveLocalPolicyNumber(directory = path.resolve(process.cwd(), '.local-data')): string {
  fs.mkdirSync(directory, { recursive: true });
  const lockPath = path.join(directory, 'policy-numbers.lock');
  const lock = fs.openSync(lockPath, 'wx', 0o600);
  try {
    const file = path.join(directory, 'policy-numbers.log');
    let last = 120604999n;
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line) continue;
        if (!/^\d+$/.test(line)) throw new Error('POLICY_COUNTER_CORRUPT');
        const value = BigInt(line);
        if (value > last) last = value;
      }
    }
    const next = last + 1n;
    const journal = fs.openSync(file, 'a', 0o600);
    try {
      fs.writeFileSync(journal, `${next}\n`);
      fs.fsyncSync(journal);
    } finally {
      fs.closeSync(journal);
    }
    return `${next}-0`;
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}

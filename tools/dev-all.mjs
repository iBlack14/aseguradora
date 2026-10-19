import { spawn } from 'child_process';

const services = [
  { name: 'API  ', command: 'npm', args: ['run', 'dev:api'], color: '\x1b[36m' }, // Cyan
  { name: 'WEB  ', command: 'npm', args: ['run', 'dev:web'], color: '\x1b[32m' }, // Green
  { name: 'ADMIN', command: 'npm', args: ['run', 'dev:admin'], color: '\x1b[35m' } // Magenta
];

const resetColor = '\x1b[0m';
const children = [];

console.log('\x1b[1m\x1b[34m%s\x1b[0m', '==================================================');
console.log('\x1b[1m\x1b[34m%s\x1b[0m', '   Iniciando Plataforma Seguros Falabella');
console.log('\x1b[1m\x1b[34m%s\x1b[0m', '   - Web (Cliente):      http://localhost:3000');
console.log('\x1b[1m\x1b[34m%s\x1b[0m', '   - Admin (Operaciones): http://localhost:3001');
console.log('\x1b[1m\x1b[34m%s\x1b[0m', '   - API (Backend):      http://localhost:4000');
console.log('\x1b[1m\x1b[34m%s\x1b[0m', '==================================================\n');

for (const svc of services) {
  const child = spawn(svc.command, svc.args, {
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        process.stdout.write(`${svc.color}[${svc.name}]${resetColor} ${line}\n`);
      }
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        process.stderr.write(`${svc.color}[${svc.name}]${resetColor} ${line}\n`);
      }
    }
  });

  child.on('close', (code) => {
    console.log(`${svc.color}[${svc.name}]${resetColor} proceso finalizado con código ${code}`);
  });

  children.push(child);
}

function cleanup() {
  console.log('\nCerrando todos los servicios...');
  for (const child of children) {
    if (child.pid) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
        } else {
          child.kill('SIGTERM');
        }
      } catch {}
    }
  }
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

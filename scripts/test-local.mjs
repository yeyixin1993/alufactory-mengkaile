import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const python = path.join(root, 'alufactory-backend', '.venv-local', 'bin', 'python');

if (!existsSync(python)) {
  console.error('Local backend environment is missing. Run: npm run setup:local');
  process.exit(1);
}

const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  child.on('error', reject);
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
});

const backend = spawn(python, ['run_local.py'], {
  cwd: path.join(root, 'alufactory-backend'),
  stdio: 'inherit',
  env: process.env,
});

const stopBackend = () => {
  if (!backend.killed) backend.kill('SIGTERM');
};
process.on('SIGINT', () => {
  stopBackend();
  process.exit(130);
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:5001/api/health');
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Backend is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Local backend did not become ready on port 5001.');

  await run(process.execPath, ['scripts/local-backend-smoke.mjs']);
  await run(path.join(root, 'node_modules', '.bin', 'vite'), ['build']);
  console.log('Local isolated full-stack checks passed. No production API was used.');
} finally {
  stopBackend();
}

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const python = path.join(root, 'alufactory-backend', '.venv-local', 'bin', 'python');
const vite = path.join(root, 'node_modules', '.bin', 'vite');

if (!existsSync(python)) {
  console.error('Local backend environment is missing. Run: npm run setup:local');
  process.exit(1);
}

const children = [];
let stopping = false;

const stop = (exitCode = 0) => {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => {
    if (!child.killed) child.kill('SIGTERM');
  });
  setTimeout(() => process.exit(exitCode), 250);
};

const start = (command, args, cwd = root) => {
  const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`${path.basename(command)} stopped unexpectedly (${signal || code}).`);
      stop(code || 1);
    }
  });
  return child;
};

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

start(python, ['run_local.py'], path.join(root, 'alufactory-backend'));
start(vite, ['--port', '3000']);

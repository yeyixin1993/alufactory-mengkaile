import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const python = process.env.LOCAL_PYTHON || path.join(root, 'alufactory-backend/.venv-local/bin/python');
const keyFile = path.join(root, 'alufactory-backend/.env.deepseek.local');
if (!existsSync(python) || !existsSync(keyFile)) {
  console.error('请先准备 Python 环境和 alufactory-backend/.env.deepseek.local，参阅 docs/DEEPSEEK_LOCAL_TEST.md。');
  process.exit(1);
}
for (const port of [3000, 5001]) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  }).catch(() => {
    console.error(`端口 ${port} 已被占用。请在原本地服务终端按 Ctrl+C，再运行此命令；不会自动终止已有服务。`);
    process.exit(1);
  });
}
const children = [];
let stopping = false;
const stop = (code=0) => {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  setTimeout(() => process.exit(code), 250);
};
const start = (command, args, cwd, env) => {
  const child = spawn(command, args, {cwd, env, stdio:'inherit'});
  children.push(child);
  child.on('error', () => { console.error('启动失败，请检查本地运行环境。'); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 0); });
};
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
const env = {...process.env, VITE_API_URL:'http://127.0.0.1:5001/api'};
// Key file is backend-only. Never pass inherited provider secrets to Vite.
delete env.DEEPSEEK_API_KEY;
delete env.DASHSCOPE_API_KEY;
start(python, ['run_deepseek_local.py'], path.join(root, 'alufactory-backend'), env);
start(path.join(root,'node_modules/.bin/vite'), ['--host','127.0.0.1','--port','3000','--strictPort'], root, env);
console.log('打开 http://127.0.0.1:3000/；Ctrl+C 关闭前后端。真实模型调用会消耗 DeepSeek 余额。');

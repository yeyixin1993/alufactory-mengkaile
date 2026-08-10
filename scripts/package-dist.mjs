import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = join(projectRoot, 'dist');
const downloadDirectory = process.env.MENGKAILE_DOWNLOAD_DIR || join(homedir(), 'Downloads');
const zipPath = join(downloadDirectory, 'mengkaile-dist-latest.zip');
const temporaryZipPath = `${zipPath}.tmp.zip`;

if (!existsSync(distDirectory)) {
  throw new Error(`dist directory does not exist: ${distDirectory}. Run npm run build first.`);
}

mkdirSync(downloadDirectory, { recursive: true });
rmSync(temporaryZipPath, { force: true });

const result = spawnSync('/usr/bin/zip', [
  '-r',
  '-q',
  '-X',
  temporaryZipPath,
  'dist',
  '-x',
  '*/.DS_Store',
  '*/._*',
  '__MACOSX/*',
], { cwd: projectRoot, stdio: 'inherit' });

if (result.status !== 0 || !existsSync(temporaryZipPath)) {
  rmSync(temporaryZipPath, { force: true });
  throw new Error(`Unable to package dist (zip exit ${result.status ?? 'unknown'}).`);
}

rmSync(zipPath, { force: true });
renameSync(temporaryZipPath, zipPath);
const sizeMb = (statSync(zipPath).size / 1024 / 1024).toFixed(1);
console.log(`Latest upload bundle: ${zipPath} (${sizeMb} MB)`);

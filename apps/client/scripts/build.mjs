import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const run = (command) => {
  execSync(command, { stdio: 'inherit', shell: true });
};

const cleanReleaseOutput = () => {
  const releaseDir = path.join(process.cwd(), 'release');

  try {
    rmSync(releaseDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      `Unable to clear previous release output at ${releaseDir}. Packaging may fail if files are locked.`
    );
    console.warn(`Reason: ${error?.message ?? error}`);
  }
};

const canCreateSymlinks = () => {
  if (process.platform !== 'win32') return true;

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ct-symlink-test-'));
  const targetFile = path.join(tempDir, 'target.txt');
  const linkFile = path.join(tempDir, 'link.txt');

  writeFileSync(targetFile, 'test');

  try {
    symlinkSync(targetFile, linkFile);
    return true;
  } catch (error) {
    console.warn(
      'Skipping electron-builder: unable to create symbolic links on this system. Enable Developer Mode or run with elevated permissions to package the app.'
    );
    console.warn(`Reason: ${error?.message ?? error}`);
    return false;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

run('npx tsc -p tsconfig.json');
run('npx vite build');

if (process.env.SKIP_ELECTRON_BUILDER === 'true') {
  console.log('Skipping electron-builder because SKIP_ELECTRON_BUILDER=true');
} else if (canCreateSymlinks()) {
  cleanReleaseOutput();
  run('npx electron-builder');
}

import { execSync } from 'node:child_process';

const run = (command) => {
  execSync(command, { stdio: 'inherit', shell: true });
};

run('npx tsc -p tsconfig.json');
run('npx vite build');

if (process.env.SKIP_ELECTRON_BUILDER === 'true') {
  console.log('Skipping electron-builder because SKIP_ELECTRON_BUILDER=true');
} else {
  run('npx electron-builder');
}

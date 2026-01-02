import { execSync } from 'node:child_process';

const run = (command) => {
  execSync(command, { stdio: 'inherit', shell: true });
};

run('npx tsc -p tsconfig.json');
run('npx vite build');

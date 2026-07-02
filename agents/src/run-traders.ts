// starts momo + meanie in one process group, prefixing output
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));

for (const agent of ['momo', 'meanie']) {
  const child = spawn('pnpm', ['tsx', join(here, `${agent}.ts`)], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => {
    console.error(`[${agent}] exited with ${code}`);
    process.exitCode = code ?? 1;
  });
}

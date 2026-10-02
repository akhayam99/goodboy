import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT =
  process.env.FEATURE_DOCS_ROOT ?? resolve(fileURLToPath(new URL('..', import.meta.url)));

try {
  execFileSync('node', ['scripts/split-features.mjs', '--check'], { cwd: ROOT, stdio: 'inherit' });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

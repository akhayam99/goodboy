import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DOCS_ROOT = process.env.FEATURE_DOCS_ROOT ?? REPO_ROOT;

try {
  execFileSync('node', [resolve(REPO_ROOT, 'scripts/split-features.mjs'), '--check'], {
    cwd: REPO_ROOT,
    env: { ...process.env, FEATURE_DOCS_ROOT: DOCS_ROOT },
    stdio: 'inherit',
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

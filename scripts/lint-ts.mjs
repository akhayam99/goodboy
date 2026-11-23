import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LINT_HEAP_MB = 7168;

export const LINT_ROOT_GROUPS = [['apps/desktop/src'], ['packages', 'website/src']];

const STRICT_ARGS = [
  '-c',
  'eslint.strict.config.mjs',
  '--suppressions-location',
  'eslint-suppressions-strict.json',
];

export const lintRunsOf = ({ argv }) => {
  const isStrict = argv.includes('--strict');
  const passThrough = argv.filter((arg) => arg !== '--strict');
  const configArgs = isStrict ? STRICT_ARGS : [];
  return LINT_ROOT_GROUPS.map((roots) => [
    `--max-old-space-size=${LINT_HEAP_MB}`,
    'node_modules/eslint/bin/eslint.js',
    ...configArgs,
    ...passThrough,
    ...roots,
  ]);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failed = lintRunsOf({ argv: process.argv.slice(2) }).filter(
    (args) => spawnSync(process.execPath, args, { stdio: 'inherit' }).status !== 0,
  );
  process.exit(failed.length > 0 ? 1 : 0);
}

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedSinceBaseOf } from './lib/changedSinceBaseOf.mjs';
import { gitRunnerOf } from './lib/gitRunnerOf.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEBSITE_PATHS = ['website', 'CHANGELOG.md', 'FEATURES.md', 'docs/features'];

export const websiteBuildDecisionOf = ({ env, git }) =>
  changedSinceBaseOf({ env, paths: WEBSITE_PATHS, git });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { shouldBuild, reason } = websiteBuildDecisionOf({
    env: process.env,
    git: gitRunnerOf({ cwd: ROOT }),
  });
  const environment = process.env.VERCEL_ENV ?? '';
  if (shouldBuild) {
    console.log(`website build: ${environment}, ${reason}`);
    process.exit(1);
  }
  console.log(`website build skipped: ${environment}, ${reason}`);
  process.exit(0);
}

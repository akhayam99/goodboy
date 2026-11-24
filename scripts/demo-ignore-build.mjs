import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedSinceBaseOf } from './lib/changedSinceBaseOf.mjs';
import { gitRunnerOf } from './lib/gitRunnerOf.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_SUBJECT = /^chore\(repo\): release \d+\.\d+\.\d+(?: \(#\d+\))?$/;
const DEMO_PATHS = [
  'apps/desktop/src',
  'apps/desktop/index.html',
  'apps/desktop/public',
  'apps/desktop/vite',
  'apps/desktop/vite.config.ts',
  'apps/desktop/tsconfig.json',
  'apps/desktop/tsconfig.build.json',
  'apps/desktop/package.json',
  'apps/desktop/vercel.json',
  ':(glob)packages/*/src/**',
  ':(glob)packages/*/package.json',
  'tsconfig.base.json',
  'pnpm-lock.yaml',
];

export const demoBuildDecisionOf = ({ env, git }) => {
  if ((env.VERCEL_ENV ?? '') !== 'production') {
    return changedSinceBaseOf({ env, paths: DEMO_PATHS, git });
  }
  const subject = (env.VERCEL_GIT_COMMIT_MESSAGE ?? '').split('\n')[0].trim();
  if (RELEASE_SUBJECT.test(subject)) {
    return { shouldBuild: true, reason: `release commit "${subject}"` };
  }
  return { shouldBuild: false, reason: `"${subject}" is not a release commit` };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { shouldBuild, reason } = demoBuildDecisionOf({
    env: process.env,
    git: gitRunnerOf({ cwd: ROOT }),
  });
  const environment = process.env.VERCEL_ENV ?? '';
  if (shouldBuild) {
    console.log(`demo build: ${environment}, ${reason}`);
    process.exit(1);
  }
  console.log(`demo build skipped: ${environment}, ${reason}`);
  process.exit(0);
}

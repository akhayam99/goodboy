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
  const previousSha = env.VERCEL_GIT_PREVIOUS_SHA ?? '';
  if (previousSha !== '' && git({ args: ['cat-file', '-e', `${previousSha}^{commit}`] }).status === 0) {
    const { status, stdout } = git({ args: ['log', '--format=%s', `${previousSha}..HEAD`] });
    const release = status === 0 ? stdout.split('\n').find((line) => RELEASE_SUBJECT.test(line.trim())) : undefined;
    if (release !== undefined) {
      return { shouldBuild: true, reason: `release commit "${release.trim()}" since the last deploy` };
    }
    if (status === 0) {
      return { shouldBuild: false, reason: 'no release commit since the last deploy' };
    }
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

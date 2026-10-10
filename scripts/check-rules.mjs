import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectSources,
  describeOffense,
  offensesFor,
  readBaselines,
  readSource,
  REPO_ROOT,
} from './rules/forbiddenPatterns.mjs';

const DEFAULT_BASE = 'origin/main';

export const findOffenses = ({ files, baselines }) =>
  offensesFor({
    sources: files.flatMap(({ path, text }) => {
      const source = readSource({ path, text });
      return source === null ? [] : [source];
    }),
    baselines,
  }).map((offense) => describeOffense({ offense }));

const git = ({ args }) =>
  execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const splitNul = ({ output }) => output.split('\0').filter((entry) => entry !== '');

const stagedFiles = () =>
  splitNul({
    output: git({ args: ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'] }),
  }).map((path) => ({ path, text: git({ args: ['show', `:${path}`] }) }));

const mergeBaseOf = ({ base }) => {
  try {
    return git({ args: ['merge-base', base, 'HEAD'] }).trim();
  } catch {
    return base;
  }
};

const diffFiles = ({ base }) => {
  try {
    git({ args: ['rev-parse', '--verify', '--quiet', `${base}^{commit}`] });
  } catch {
    throw new Error(`base ref ${base} not found: run git fetch origin main`);
  }
  const from = mergeBaseOf({ base });
  return splitNul({
    output: git({ args: ['diff', '--name-only', '-z', '--diff-filter=ACMR', from, 'HEAD'] }),
  }).flatMap((path) => {
    const full = join(REPO_ROOT, path);
    return existsSync(full) ? [{ path, text: readFileSync(full, 'utf8') }] : [];
  });
};

const baseFromArgs = ({ args }) => {
  const at = args.indexOf('--diff');
  const next = args[at + 1];
  return at >= 0 && next !== undefined && !next.startsWith('--') ? next : DEFAULT_BASE;
};

export const run = ({ args }) => {
  const baselines = readBaselines();
  if (args.includes('--all')) {
    const offenses = offensesFor({ sources: collectSources(), baselines });
    return offenses.map((offense) => describeOffense({ offense }));
  }
  const files = args.includes('--staged')
    ? stagedFiles()
    : diffFiles({ base: baseFromArgs({ args }) });
  return findOffenses({ files, baselines });
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const lines = run({ args: process.argv.slice(2) });
    if (lines.length === 0) {
      console.log('rules ok');
    } else {
      console.error(`rules failed: ${lines.length} new offense${lines.length === 1 ? '' : 's'}`);
      console.error(lines.join('\n'));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`rules failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIRECTORY = 'packages/db/src/migrations';
const MIGRATION_FILE = /\/m\d+[^/]*\.ts$/;
const TEST_FILE = /\.test\.ts$/;
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;
const ONE_WAY_DOOR_TRAILER = /^One-way-door:[\t ]*(.+)$/gm;
const RELEASE_KINDS = new Set(['patch', 'minor']);

const git = ({ args }) =>
  execFileSync('git', args, { cwd: ROOT_DIRECTORY, encoding: 'utf8' }).trim();

const readArgs = ({ argv }) => {
  const args = { since: null, requested: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--') {
      continue;
    }
    if (flag === '--since' && value !== undefined) {
      args.since = value;
      index += 1;
      continue;
    }
    if (flag === '--requested' && value !== undefined) {
      args.requested = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${flag}`);
  }
  if (args.requested !== null && !RELEASE_KINDS.has(args.requested)) {
    throw new Error(`--requested must be patch or minor, got ${args.requested}`);
  }
  return args;
};

const lastReleaseTag = () => {
  const tags = git({ args: ['tag', '--list', 'v*', '--sort=-v:refname'] }).split('\n');
  const tag = tags.find((candidate) => RELEASE_TAG.test(candidate));
  if (tag === undefined) {
    throw new Error('no release tag found');
  }
  return tag;
};

const newMigrations = ({ since }) =>
  git({
    args: ['diff', '--name-only', '--diff-filter=A', since, 'HEAD', '--', MIGRATIONS_DIRECTORY],
  })
    .split('\n')
    .filter((path) => MIGRATION_FILE.test(path) && !TEST_FILE.test(path))
    .map((path) => path.slice(MIGRATIONS_DIRECTORY.length + 1));

const oneWayDoors = ({ since }) => {
  const log = git({ args: ['log', `${since}..HEAD`, '--format=%B'] });
  return [...log.matchAll(ONE_WAY_DOOR_TRAILER)].map((match) => match[1].trim());
};

const main = () => {
  const { since: sinceArg, requested } = readArgs({ argv: process.argv.slice(2) });
  const since = sinceArg ?? lastReleaseTag();
  const reasons = [
    ...newMigrations({ since }).map((file) => `new migration ${file}`),
    ...oneWayDoors({ since }).map((door) => `one-way door: ${door}`),
  ];
  const kind = reasons.length > 0 ? 'minor' : 'patch';

  console.log(kind);
  if (reasons.length === 0) {
    console.log(`- no migration or one-way door since ${since}`);
  }
  for (const reason of reasons) {
    console.log(`- ${reason}`);
  }

  if (requested === 'patch' && kind === 'minor') {
    console.error(
      `a patch was requested, but ${since}..HEAD holds a one-way door: release a minor`,
    );
    process.exit(1);
  }
};

main();

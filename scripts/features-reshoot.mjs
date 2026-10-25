import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFigures, ROOT_DIRECTORY } from './lib/figures.mjs';
import { includesHeroOf, reshootPlanOf } from './lib/reshootPlan.mjs';

const USAGE = `usage: pnpm features:reshoot [--area <guide>] [--theme dark|light]
  [--out-dir <folder>] [--base <url>] [--version x.y.z] [--wait <ms>] [--dry-run]
  replays every recipe of docs/figures.json through scripts/feature-shots.mjs
  (and the README hero through scripts/readme-hero.mjs).
  --area    only the figures whose name is <guide> or starts with <guide>-
  --theme   only that theme; versions in docs/figures.json do not move
  --out-dir write under <folder>/features, versions do not move, hero skipped
  --dry-run list what would be shot`;

const VALUE_FLAGS = new Set(['area', 'theme', 'out-dir', 'base', 'version', 'wait']);

export const parseReshootArgs = ({ argv }) => {
  const options = { isDryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index].replace(/^--/, '');
    if (flag === 'dry-run') {
      options.isDryRun = true;
      continue;
    }
    if (!VALUE_FLAGS.has(flag) || argv[index + 1] === undefined) {
      throw new Error(USAGE);
    }
    options[flag] = argv[index + 1];
    index += 1;
  }
  return options;
};

const shotScript = (name) => resolve(ROOT_DIRECTORY, 'scripts', name);

const runStep = ({ script, args, env }) => {
  execFileSync(process.execPath, [shotScript(script), ...args], {
    cwd: ROOT_DIRECTORY,
    env,
    stdio: 'inherit',
  });
};

const main = () => {
  const options = parseReshootArgs({ argv: process.argv.slice(2) });
  const figures = readFigures();
  const plan = reshootPlanOf({ figures, area: options.area, theme: options.theme });
  const isHeroIncluded =
    options['out-dir'] === undefined &&
    includesHeroOf({ figures, area: options.area, theme: options.theme });
  const shared = [];
  if (options.base !== undefined) {
    shared.push('--base', options.base);
  }
  if (options.version !== undefined) {
    shared.push('--version', options.version);
  }
  if (options.wait !== undefined) {
    shared.push('--wait', options.wait);
  }
  if (options.isDryRun) {
    plan.steps.forEach(({ key }) => console.log(`would shoot ${key}`));
    plan.skipped.forEach((key) => console.log(`no recipe, shoot by hand: ${key}`));
    console.log(isHeroIncluded ? 'would shoot readme/readme-hero' : 'readme hero left alone');
    return;
  }
  const env = { ...process.env };
  const isVersionFrozen = options['out-dir'] !== undefined || options.theme !== undefined;
  if (isVersionFrozen) {
    const scratch = mkdtempSync(join(tmpdir(), 'features-reshoot-'));
    const figuresCopy = join(scratch, 'figures.json');
    copyFileSync(resolve(ROOT_DIRECTORY, 'docs/figures.json'), figuresCopy);
    env.GOODBOY_FIGURES_PATH = figuresCopy;
    console.log('docs/figures.json stays as it is: versions do not move for a partial reshoot');
  }
  if (options['out-dir'] !== undefined) {
    const mediaDirectory = resolve(options['out-dir']);
    mkdirSync(join(mediaDirectory, 'features'), { recursive: true });
    env.GOODBOY_MEDIA_DIR = mediaDirectory;
  }
  const failed = [];
  for (const { key, args } of plan.steps) {
    try {
      runStep({ script: 'feature-shots.mjs', args: [...args, ...shared], env });
    } catch {
      failed.push(key);
    }
  }
  if (isHeroIncluded) {
    try {
      runStep({
        script: 'readme-hero.mjs',
        args: [
          ...(options.base === undefined ? [] : [options.base]),
          ...(options.version === undefined ? [] : ['--version', options.version]),
        ],
        env,
      });
    } catch {
      failed.push('readme/readme-hero');
    }
  }
  plan.skipped.forEach((key) => console.log(`no recipe, shoot by hand: ${key}`));
  const shot = plan.steps.length - failed.filter((key) => key !== 'readme/readme-hero').length;
  console.log(`reshoot done: ${shot} of ${plan.steps.length} figures, ${failed.length} failed`);
  failed.forEach((key) => console.error(`failed: ${key}`));
  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

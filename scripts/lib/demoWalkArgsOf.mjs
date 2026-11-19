import { resolve } from 'node:path';

export const DEMO_WALK_USAGE = `usage: node scripts/demo-walk.mjs --out-dir <folder>
  [--window 1440x900] [--theme dark|light] [--only fix-start,fix-push]
  [--stop-after fix-push] [--clip 8,64,1420,824] [--base http://localhost:5230]`;

const clipOf = ({ value }) => {
  if (value === undefined) {
    return null;
  }
  const numbers = value.split(',').map(Number);
  if (numbers.length !== 4 || numbers.some((number) => !Number.isInteger(number) || number < 0)) {
    throw new Error(DEMO_WALK_USAGE);
  }
  const [x, y, width, height] = numbers;
  if (width === 0 || height === 0) {
    throw new Error(DEMO_WALK_USAGE);
  }
  return { x, y, width, height };
};

export const demoWalkArgsOf = ({ argv, fallbackBase }) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, '');
    if (!key || argv[index + 1] === undefined) {
      throw new Error(DEMO_WALK_USAGE);
    }
    args[key] = argv[index + 1];
  }
  if (!args['out-dir']) {
    throw new Error(DEMO_WALK_USAGE);
  }
  const [width, height] = (args.window ?? '1440x900').split('x').map(Number);
  const theme = args.theme ?? 'dark';
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error(DEMO_WALK_USAGE);
  }
  return {
    outDir: resolve(args['out-dir']),
    width,
    height,
    theme,
    only: args.only ? new Set(args.only.split(',')) : null,
    stopAfter: args['stop-after'] ?? null,
    clip: clipOf({ value: args.clip }),
    base: args.base ?? fallbackBase,
  };
};

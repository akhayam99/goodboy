const FOLDERS: ReadonlyArray<readonly [string, number]> = [
  ['apps/web/src/components', 58],
  ['apps/web/src/routes', 30],
  ['apps/web/src/hooks', 23],
  ['apps/api/src/handlers', 64],
  ['apps/api/src/jobs', 26],
  ['packages/ledger-core/src', 48],
  ['packages/notify-relay/src', 40],
  ['packages/payments-api/src/steps', 52],
  ['test/ledger', 60],
  ['test/webhooks', 34],
  ['docs/guides', 14],
  ['db/migrations', 20],
  ['dist/ledger-core', 42],
];

const LOCK_PATH = 'pnpm-lock.yaml';

const NAMES = [
  'Account',
  'Balance',
  'Invoice',
  'Payout',
  'Refund',
  'Statement',
  'Transfer',
  'Webhook',
];
const KINDS = ['Badge', 'Card', 'Detail', 'Edit', 'Export', 'List', 'New', 'Row', 'Sheet', 'View'];

const nameOf = (index: number): string => {
  const base = `${NAMES[index % NAMES.length] ?? 'Account'}${KINDS[Math.floor(index / NAMES.length) % KINDS.length] ?? 'Row'}`;
  const round = Math.floor(index / (NAMES.length * KINDS.length));
  return round === 0 ? base : `${base}${round + 1}`;
};

const extensionOf = (folder: string): string => {
  if (folder.startsWith('docs')) {
    return 'md';
  }
  if (folder.startsWith('db')) {
    return 'sql';
  }
  return folder.includes('components') || folder.includes('routes') ? 'tsx' : 'ts';
};

const fileText = ({ path, seed }: { readonly path: string; readonly seed: number }): string => {
  const count = 2 + ((seed * 7) % 6);
  const added = Array.from(
    { length: count },
    (_, line) => `+export const step${seed}x${line + 1} = (cents: number) => cents + ${line + 1};`,
  );
  return [
    `diff --git a/${path} b/${path}`,
    `index ${(seed + 4096).toString(16)}a1..${(seed + 8192).toString(16)}b2 100644`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,1 +1,${count + 1} @@`,
    " import { roundCents } from '../money';",
    ...added,
  ].join('\n');
};

const paths = (): ReadonlyArray<string> => [
  ...FOLDERS.flatMap(([folder, total]) =>
    Array.from(
      { length: total },
      (_, index) => `${folder}/${nameOf(index)}.${extensionOf(folder)}`,
    ),
  ),
  LOCK_PATH,
];

export const LARGE_PATCH = `${paths()
  .map((path, seed) => fileText({ path, seed }))
  .join('\n')}\n`;

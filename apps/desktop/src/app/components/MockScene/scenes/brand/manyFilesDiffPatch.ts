import { BRANCH_FILES_PATCH } from './contextDiffPatch';

const EXTRA_FILES = 34;

const lengthOf = (index: number): number => 4 + ((index * 29) % 90);

const folderOf = (index: number): string =>
  ['src/ledger/rules', 'src/webhooks/handlers', 'src/payouts/steps', 'test/ledger'][index % 4] ??
  'src/ledger/rules';

const fileText = (index: number): string => {
  const name = `rule${String(index + 1).padStart(2, '0')}`;
  const path = `${folderOf(index)}/${name}.ts`;
  const count = lengthOf(index);
  const added = Array.from(
    { length: count },
    (_, line) => `+export const ${name}Step${line + 1} = (cents: number) => cents + ${line + 1};`,
  );
  return [
    `diff --git a/${path} b/${path}`,
    `index ${(index + 4096).toString(16)}a1..${(index + 8192).toString(16)}b2 100644`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,1 +1,${count + 1} @@`,
    " import { roundCents } from '../money';",
    ...added,
  ].join('\n');
};

export const MANY_FILES_PATCH = `${BRANCH_FILES_PATCH}${Array.from({ length: EXTRA_FILES }, (_, index) => fileText(index)).join('\n')}\n`;

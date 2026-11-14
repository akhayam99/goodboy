const FOLDERS = [
  'ledger-core/src/rules',
  'ledger-core/src/postings',
  'notify-relay/src/handlers',
  'notify-relay/src/templates',
  'payments-api/src/routes',
  'payments-api/src/steps',
  'payments-api/test/routes',
  'payments-api/test/steps',
] as const;

type IndexParams = {
  readonly index: number;
};

const pathOf = ({ index }: IndexParams): string => {
  const folder = FOLDERS[index % FOLDERS.length] ?? 'payments-api/src/routes';
  return `${folder}/step${String(index + 1).padStart(3, '0')}.ts`;
};

const fileText = ({ index }: IndexParams): string => {
  const path = pathOf({ index });
  const name = `step${index + 1}`;
  const added = 1 + (index % 7);
  return [
    `diff --git a/${path} b/${path}`,
    `index ${(index + 4096).toString(16)}a1..${(index + 8192).toString(16)}b2 100644`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,2 +1,${added + 1} @@`,
    " import { roundCents } from '../money';",
    `-export const ${name} = (cents: number) => cents;`,
    ...Array.from(
      { length: added },
      (_, line) => `+export const ${name}Part${line + 1} = (cents: number) => roundCents(cents);`,
    ),
  ].join('\n');
};

export const CHANGES_300_FILES_PATCH = `${Array.from({ length: 300 }, (_, index) =>
  fileText({ index }),
).join('\n')}\n`;

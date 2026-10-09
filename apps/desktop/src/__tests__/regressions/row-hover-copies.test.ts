// @vitest-environment node
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const BASELINE = join(__dirname, 'row-hover-copies.baseline.json');

type WalkParams = { readonly directory: string };
const walk = ({ directory }: WalkParams): ReadonlyArray<string> =>
  readdirSync(directory).flatMap((name) => {
    if (name === '__tests__') {
      return [];
    }
    const file = join(directory, name);
    if (statSync(file).isDirectory()) {
      return walk({ directory: file });
    }
    return file.endsWith('.tsx') && !file.includes('.test.') ? [file] : [];
  });

type CountParams = { readonly text: string };
const countCopies = ({ text }: CountParams): number => {
  const ast = ts.createSourceFile('row.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) &&
      node.text.split(/\s+/).includes('hover:bg-hover') &&
      (node.text.includes('w-full') || node.text.split(/\s+/).includes('focus-visible:ring-2')) &&
      !/(?:\bsize-|\bh-[67]\b)/.test(node.text)
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return count;
};

it('detects full-width hover copies and copied focus rings', () => {
  expect(countCopies({ text: '<button className="w-full hover:bg-hover" />' })).toBe(1);
  expect(countCopies({ text: '<button className="hover:bg-hover focus-visible:ring-2" />' })).toBe(
    1,
  );
  expect(countCopies({ text: '<button className="size-6 w-full hover:bg-hover" />' })).toBe(0);
  expect(countCopies({ text: '<button className={cn("w-full", ROW_INTERACTIVE)} />' })).toBe(0);
});

it('keeps row hover and focus copies below the integration baseline', () => {
  const counts = Object.fromEntries(
    walk({ directory: ROOT }).flatMap((file) => {
      const count = countCopies({ text: readFileSync(file, 'utf8') });
      return count === 0 ? [] : [[relative(ROOT, file), count]];
    }),
  );
  if (process.env.GOODBOY_UPDATE_BASELINE === '1') {
    writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
  }
  const baseline: unknown = JSON.parse(readFileSync(BASELINE, 'utf8'));
  if (typeof baseline !== 'object' || baseline === null) {
    throw new Error('Invalid row hover baseline');
  }
  const grown = Object.entries(counts).filter(([file, count]) => {
    const allowed: unknown = Reflect.get(baseline, file);
    return count > (typeof allowed === 'number' ? allowed : 0);
  });
  expect(grown, 'Use ROW_INTERACTIVE for clickable rows').toEqual([]);
});

// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules']);

const BANNED_PHRASES: ReadonlyArray<string> = [
  'Bring them in',
  'Bring them back',
  'Bring them into the plan',
  'Keep branch as it was',
  'Take off this branch',
  'Fold down',
  'Who reads this',
  'Fix it anyway',
  'Copy last reply',
];

const BANNED_LABELS: ReadonlyArray<string> = ['Keep', 'Separate', 'Stop keeping'];

type WalkParams = {
  readonly dir: string;
};

const sourceFilesOf = ({ dir }: WalkParams): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    if (SKIP_SEGMENTS.has(name)) {
      return [];
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFilesOf({ dir: path });
    }
    const isSource = (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.includes('.test.');
    return isSource ? [path] : [];
  });

const LABEL_PATTERN = /\blabel: '([^']+)'/g;

describe('action names say what they do', () => {
  const files = sourceFilesOf({ dir: SOURCE_ROOT }).filter(
    (path) => !path.endsWith('names.ts') || !path.includes(`shared${sep}utils`),
  );

  it('keeps every metaphor and object-less phrase out of the source', () => {
    const hits = files.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return BANNED_PHRASES.filter((phrase) => source.includes(phrase)).map(
        (phrase) => `${relative(SOURCE_ROOT, path)}: ${phrase}`,
      );
    });
    expect(hits).toEqual([]);
  });

  it('gives every action kind a label with an object', () => {
    const hits = files
      .filter((path) => path.includes(`features${sep}actions${sep}kinds${sep}`))
      .flatMap((path) =>
        [...readFileSync(path, 'utf8').matchAll(LABEL_PATTERN)]
          .map((match) => match[1] ?? '')
          .filter((label) => BANNED_LABELS.includes(label))
          .map((label) => `${relative(SOURCE_ROOT, path)}: ${label}`),
      );
    expect(hits).toEqual([]);
  });
});

// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const SEED_ROOTS = [
  join(__dirname, 'scenes'),
  join(__dirname, '..', '..', '..', 'features', 'workspace-chat', 'mockChatAnswers.ts'),
];

const walk = (path: string): ReadonlyArray<string> =>
  statSync(path).isDirectory()
    ? readdirSync(path).flatMap((entry) => walk(join(path, entry)))
    : [path];

const seedFiles = (): ReadonlyArray<string> =>
  SEED_ROOTS.flatMap(walk).filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path));

const idsIn = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(/identifier: '([A-Z]+-\d+)'/g)].map((match) => match[1] ?? '');

const identifiersNear = (text: string, title: string): ReadonlyArray<string> => {
  const lines = text.split('\n');
  return lines.flatMap((line, index) => {
    if (!line.includes(`'${title}'`)) {
      return [];
    }
    const own = idsIn(line);
    return own.length > 0 ? own : idsIn(lines.slice(Math.max(0, index - 3), index).join('\n'));
  });
};

describe('mock seeds name each Harborline task with one id', () => {
  it('uses the HBL prefix, never the old HAR one', () => {
    const stale = seedFiles().filter((path) => /\bHAR-\d+/.test(readFileSync(path, 'utf8')));
    expect(stale).toEqual([]);
  });

  it('gives Payments revamp the same id on the board and in Link work', () => {
    const ids = new Set(
      seedFiles().flatMap((path) => identifiersNear(readFileSync(path, 'utf8'), 'Payments revamp')),
    );
    expect([...ids]).toEqual(['HBL-400']);
  });
});

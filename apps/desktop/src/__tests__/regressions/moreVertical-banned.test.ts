import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const UI_SRC = join(SRC, '..', '..', '..', 'packages', 'ui', 'src');

const SOURCE = /\.(ts|tsx)$/;
const BANNED = /\bMoreVertical\b|\bEllipsisVertical\b/;

const sourcesOf = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules') {
      return [];
    }
    if (statSync(path).isDirectory()) {
      return sourcesOf(path);
    }
    return SOURCE.test(name) && !name.includes('moreVertical-banned') ? [path] : [];
  });

describe('overflow glyph', () => {
  it('imports the vertical dots glyph nowhere, the one overflow glyph is the ellipsis', () => {
    const offenders = [SRC, UI_SRC]
      .flatMap(sourcesOf)
      .filter((path) => BANNED.test(readFileSync(path, 'utf8')));

    expect(offenders).toEqual([]);
  });
});

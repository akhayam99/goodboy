// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules']);
const ALLOWED = new Set([
  'app/components/GoodboyChip/GoodboyChipLabel.tsx',
  'app/components/GoodboyChip/GoodboyMenu.tsx',
  'app/components/BootSplash/BootBrand.tsx',
]);

const listSourceFiles = ({ dir }: { readonly dir: string }): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    if (SKIP_SEGMENTS.has(entry)) {
      return [];
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return listSourceFiles({ dir: full });
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) {
      return [];
    }
    return [full];
  });

describe('DogMascot', () => {
  it('marks the brand only: the Goodboy chip, its menu and the boot splash', () => {
    const users = listSourceFiles({ dir: SRC })
      .filter((file) => readFileSync(file, 'utf8').includes('DogMascot'))
      .map((file) => relative(SRC, file).split(sep).join('/'))
      .sort();

    expect(users.filter((file) => !ALLOWED.has(file))).toEqual([]);
    expect(users).toEqual([...ALLOWED].sort());
  });
});

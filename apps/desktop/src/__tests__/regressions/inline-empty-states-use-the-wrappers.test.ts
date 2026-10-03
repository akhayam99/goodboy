// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules']);
const HAND_ROLLED_INLINE = /size="inline"/;

const listSourceFiles = ({ dir }: { readonly dir: string }): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    if (SKIP_SEGMENTS.has(entry)) {
      return [];
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return listSourceFiles({ dir: full });
    }
    if (!entry.endsWith('.tsx') || entry.endsWith('.test.tsx')) {
      return [];
    }
    return [full];
  });

describe('inline empty states', () => {
  it('go through FilledEmptyState or LensEmptyState, never a hand-rolled EmptyState size="inline"', () => {
    const offenders = listSourceFiles({ dir: SRC })
      .filter((file) => HAND_ROLLED_INLINE.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file).split(sep).join('/'));

    expect(offenders).toEqual([]);
  });
});

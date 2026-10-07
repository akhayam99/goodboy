// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');

const SKIPPED: ReadonlySet<string> = new Set(['node_modules', '__tests__']);

const isSource = (name: string): boolean =>
  (name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.css')) &&
  !name.endsWith('.test.ts') &&
  !name.endsWith('.test.tsx');

const sources = ({ directory }: { readonly directory: string }): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      return sources({ directory: full });
    }
    return isSource(entry) ? [full] : [];
  });
};

const filesMentioning = ({ needle }: { readonly needle: string }): ReadonlyArray<string> =>
  sources({ directory: SRC })
    .filter((file) => readFileSync(file, 'utf8').includes(needle))
    .map((file) => relative(SRC, file));

describe('a theme switch is one paint', () => {
  it('never wraps the swap in a document view transition', () => {
    expect(filesMentioning({ needle: 'startViewTransition' })).toEqual([]);
  });

  it('keeps every view transition pseudo element and name out of the styles', () => {
    expect(filesMentioning({ needle: 'view-transition' })).toEqual([]);
  });

  it('keeps element transitions off while the palette swaps', () => {
    const styles = readFileSync(join(SRC, 'styles.css'), 'utf8');

    expect(styles).toContain('html[data-theme-switching] *,');
    expect(styles).toMatch(
      /html\[data-theme-switching\] \*::after \{\s*transition: none !important;/,
    );
  });
});

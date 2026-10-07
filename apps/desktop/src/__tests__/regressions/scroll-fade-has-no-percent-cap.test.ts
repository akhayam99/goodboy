// @vitest-environment node

import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = resolve(import.meta.dirname, '../..');
const UI_ROOT = resolve(DESKTOP_ROOT, '../../../packages/ui/src');
const SCROLL_FADE_TAG = /<ScrollFade\b[^>]*>/g;
const PERCENT_CAP = /(?<![\w-])(?:[\w-]+:)*max-h-\[\d+(?:\.\d+)?%\]/;

const sourcesOf = ({ root }: { readonly root: string }): ReadonlyArray<string> =>
  globSync('**/*.tsx', { cwd: root })
    .filter((file) => !file.includes('.test.'))
    .map((file) => resolve(root, file));

describe('a ScrollFade never carries a percentage max height', () => {
  const files = [...sourcesOf({ root: DESKTOP_ROOT }), ...sourcesOf({ root: UI_ROOT })];

  it('finds the ScrollFades it guards', () => {
    const count = files.reduce(
      (total, file) => total + (readFileSync(file, 'utf8').match(SCROLL_FADE_TAG)?.length ?? 0),
      0,
    );

    expect(count).toBeGreaterThan(40);
  });

  it('keeps the cap on a parent with a definite height, never on the scroller that inherits it', () => {
    const offenders = files.flatMap((file) =>
      (readFileSync(file, 'utf8').match(SCROLL_FADE_TAG) ?? [])
        .filter((tag) => PERCENT_CAP.test(tag))
        .map((tag) => `${file.replace(DESKTOP_ROOT, '')}: ${tag.replace(/\s+/g, ' ')}`),
    );

    expect(offenders).toEqual([]);
  });
});

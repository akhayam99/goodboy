// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  countMatches,
  grownEntries,
  nonZero,
  readBaseline,
  testSources,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'no-layout-by-attribute.baseline.json';
const ELSEWHERE_BASELINE_FILE = 'no-layout-by-attribute.elsewhere.baseline.json';
const SURFACES_PREFIX = 'apps/desktop/src/__tests__/surfaces/';
const GUARDS_PREFIX = 'apps/desktop/src/__tests__/regressions/';
const SURFACES = join(__dirname, '..', 'surfaces');
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const LAYOUT_CLAIM =
  /data-width|toHaveClass\([^)]*['"`](?:[a-z-]+:)*(?:-?(?:w|min-w|max-w|h|min-h|max-h|left|right|top|bottom|inset)-|absolute\b|fixed\b|sticky\b|relative\b)/g;

const walk = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      walk(SURFACES)
        .filter((full) => /\.tsx?$/.test(full))
        .map((full) => [
          relative(REPO_ROOT, full).split(sep).join('/'),
          countMatches({ text: readFileSync(full, 'utf8'), pattern: LAYOUT_CLAIM }),
        ]),
    ),
  });

const measureElsewhere = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      testSources()
        .filter(({ path }) => !path.startsWith(SURFACES_PREFIX) && !path.startsWith(GUARDS_PREFIX))
        .map(({ path, text }) => [path, countMatches({ text, pattern: LAYOUT_CLAIM })]),
    ),
  });

const claim = ({ name }: { readonly name: string }): string =>
  ['expect(pane).', 'toHave', 'Class', `('${name}')`].join('');

describe('a layout claim is proved by geometry in a scene, never by an attribute or a class', () => {
  it('counts a width attribute and a width or position class, and leaves other classes alone', () => {
    const count = (text: string): number => countMatches({ text, pattern: LAYOUT_CLAIM });
    expect(count(['column.getAttribute(', "'data-", "width')"].join(''))).toBe(1);
    expect(count(claim({ name: 'max-w-3xl' }))).toBe(1);
    expect(count(claim({ name: 'md:absolute' }))).toBe(1);
    expect(count(claim({ name: 'text-muted-foreground' }))).toBe(0);
  });

  it('adds no layout claim by attribute or class beyond the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Prove the layout with a scene geometry probe (scripts/validate-scenes.mjs), not a data-width or a class. docs/testing.md has the rule.\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('adds no layout claim by attribute or class in any other test beyond the baseline', () => {
    const current = measureElsewhere();
    if (IS_UPDATING) {
      writeBaseline({ file: ELSEWHERE_BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({
      current,
      baseline: readBaseline({ file: ELSEWHERE_BASELINE_FILE }),
    });
    expect(
      grown,
      `Prove the layout with a scene geometry probe (scripts/validate-scenes.mjs), not a data-width or a class. docs/testing.md has the rule.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});

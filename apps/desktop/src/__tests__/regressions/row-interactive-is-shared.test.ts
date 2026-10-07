// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const TIMELINE = 'apps/desktop/src/features/session/components/SessionWorkspace/parts/TimelinePane';

const SHARED_STYLE_ROWS: ReadonlyArray<string> = [
  'packages/ui/src/components/InteractiveRow.tsx',
  'packages/ui/src/components/SelectableRow.tsx',
  `${TIMELINE}/TimelineStreamRow.tsx`,
  `${TIMELINE}/TimelineCountRow.tsx`,
  `${TIMELINE}/TimelineMoreRow.tsx`,
];

const OWN_HOVER_LAYER = /hover:bg-hover/;
const OWN_FOCUS_RING = /focus-visible:ring-2/;
const SHARED_STYLE = /ROW_INTERACTIVE|ROW_HOVER/;

const sourceOf = ({ path }: { readonly path: string }): string =>
  readFileSync(join(REPO_ROOT, path), 'utf8');

describe('a clickable row takes its hover and focus from ROW_INTERACTIVE', () => {
  it.each(SHARED_STYLE_ROWS)('%s carries no copy of the hover layer or the ring', (path) => {
    const source = sourceOf({ path });

    expect(OWN_HOVER_LAYER.test(source)).toBe(false);
    expect(OWN_FOCUS_RING.test(source)).toBe(false);
  });

  it.each(SHARED_STYLE_ROWS)('%s reads the shared style', (path) => {
    expect(SHARED_STYLE.test(sourceOf({ path }))).toBe(true);
  });

  it('keeps the shared style as the one place that names the layer', () => {
    const source = sourceOf({ path: 'packages/ui/src/rowInteractive.ts' });

    expect(source).toMatch(OWN_HOVER_LAYER);
    expect(source).toMatch(/FOCUS_RING/);
  });
});

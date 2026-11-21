// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const ROOT = join(SRC, '..', '..', '..');

const SOURCE = /\.(ts|tsx)$/;
const TEST = /\.test\.(ts|tsx)$/;

const BASELINE: ReadonlyArray<string> = [
  'apps/desktop/src/app/components/PanelBoundary/PanelFallback.tsx',
];

const EMPTY_STATE = /<EmptyState\b[^>]*?>/gs;
const WARNING_ICON =
  /\bicon=\{\s*(?:TriangleAlert|CircleAlert|AlertTriangle|OctagonAlert|ShieldAlert)\s*\}/;

type OpensWithWarningParams = {
  readonly text: string;
};

const opensWithWarning = ({ text }: OpensWithWarningParams): boolean =>
  (text.match(EMPTY_STATE) ?? []).some((tag) => WARNING_ICON.test(tag));

const filesUnder = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === 'node_modules' ? [] : filesUnder(path);
    }
    return SOURCE.test(name) && !TEST.test(name) ? [path] : [];
  });

describe('an empty state never wears a warning icon', () => {
  it('draws a failed load with ErrorStrip, never as an empty state', () => {
    const offenders = filesUnder(SRC)
      .filter((path) => opensWithWarning({ text: readFileSync(path, 'utf8') }))
      .map((path) => relative(ROOT, path));

    expect(offenders).toEqual(BASELINE);
  });

  it('flags an EmptyState that carries a warning glyph', () => {
    expect(
      opensWithWarning({ text: '<EmptyState icon={TriangleAlert} tone="warning" title="x" />' }),
    ).toBe(true);
    expect(
      opensWithWarning({ text: '<EmptyState icon={CONCEPT_ICONS.runs} title="No runs yet" />' }),
    ).toBe(false);
  });
});

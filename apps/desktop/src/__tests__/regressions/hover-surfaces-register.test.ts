// @vitest-environment node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');

const ROOTS = ['apps/desktop/src', 'packages/ui/src'];

const IS_SOURCE = /\.tsx?$/;
const IS_TEST = /\.(test|perf\.test)\.tsx?$/;

const filesUnder = ({ dir }: { readonly dir: string }): ReadonlyArray<string> =>
  readdirSync(join(REPO_ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' || entry.name === '__tests__'
        ? []
        : filesUnder({ dir: path });
    }
    return IS_SOURCE.test(entry.name) && !IS_TEST.test(entry.name) ? [path] : [];
  });

const sourceOf = ({ path }: { readonly path: string }): string =>
  readFileSync(join(REPO_ROOT, path), 'utf8');

const isFloatingSurface = ({ source }: { readonly source: string }): boolean =>
  /\buseFloatingPlace\(/.test(source) ||
  (/\buseRestHover</.test(source) && /\bcreatePortal\(/.test(source));

describe('a hover surface registers so tooltips stay quiet beside it', () => {
  const surfaces = ROOTS.flatMap((root) => filesUnder({ dir: root })).filter((path) =>
    isFloatingSurface({ source: sourceOf({ path }) }),
  );

  it('finds the three known surfaces', () => {
    expect(surfaces.map((path) => path.split('/').at(-2))).toEqual(
      expect.arrayContaining(['SideColumn', 'SessionHoverCard', 'FactCard']),
    );
  });

  it.each(surfaces)('%s calls useHoverSurface and marks its element', (path) => {
    const source = sourceOf({ path });

    expect(source).toMatch(/\buseHoverSurface\(\{ isActive: /);
    expect(source).toMatch(/data-hover-surface=""/);
  });
});

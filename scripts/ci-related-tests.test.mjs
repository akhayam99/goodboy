import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  buildGraph,
  globMatchesOf,
  relatedSelection,
  selectionLines,
  specifiersOf,
} from './ci-related-tests.mjs';

const CORE_MANIFEST = JSON.stringify({
  name: '@goodboy/core',
  exports: { './slug': { default: './src/slug/index.ts' }, './icons/*': './src/icons/*.ts' },
});

const FIXTURES = [
  ['packages/core/package.json', CORE_MANIFEST],
  ['packages/core/src/slug/index.ts', "export * from './branchName';"],
  ['packages/core/src/slug/branchName.ts', 'export const branchName = () => 1;'],
  ['packages/core/src/slug/branchName.test.ts', "import { branchName } from './branchName';"],
  ['packages/core/src/icons/dog.ts', 'export const dog = 1;'],
  ['apps/desktop/src/features/branch/label.ts', "import { branchName } from '@goodboy/core/slug';"],
  ['apps/desktop/src/features/branch/label.test.tsx', "import { label } from './label';"],
  ['apps/desktop/src/features/palette/rank.ts', 'export const rank = 1;'],
  ['apps/desktop/src/features/palette/rank.test.ts', "vi.mock('./rank', () => ({}));"],
  ['apps/desktop/src/features/palette/rank.perf.test.ts', "import { rank } from './rank';"],
  ['apps/desktop/src/features/icons/dog.test.ts', "import { dog } from '@goodboy/core/icons/dog';"],
  ['apps/desktop/vite/demoHtml.ts', 'export const demoHtml = () => 1;'],
  [
    'apps/desktop/vite/demoHtml.test.ts',
    "import { readFileSync } from 'node:fs';\nimport { demoHtml } from './demoHtml';",
  ],
  ['apps/desktop/src/features/board/BoardEmpty/index.tsx', 'export const BoardEmpty = () => null;'],
  ['apps/desktop/src/features/board/BoardEmpty/index.test.tsx', "import { BoardEmpty } from './';"],
  [
    'apps/desktop/src/app/scenes/registry.ts',
    "export const all = import.meta.glob(['./u*/*.tsx', '!./u*/*.test.tsx'], { eager: true });",
  ],
  [
    'apps/desktop/src/app/scenes/u1/board.tsx',
    "import { label } from '../../../features/branch/label';",
  ],
  ['apps/desktop/src/app/scenes/u1/board.test.tsx', "import { all } from '../registry';"],
  [
    'apps/desktop/src/app/scenes/registry.test.ts',
    "import { all } from './registry';\nimport { MockScene } from './MockScene/';",
  ],
  [
    'apps/desktop/src/__tests__/a11y/scenes.test.tsx',
    "import { all } from '../../app/scenes/registry';",
  ],
  [
    'apps/desktop/src/__tests__/regressions/rules.test.ts',
    "const fixture = `import x from './nowhere'`;",
  ],
  ['apps/desktop/src/shared/readsDocs.test.ts', "import { readFileSync } from 'node:fs';"],
];

const root = mkdtempSync(join(tmpdir(), 'ci-related-'));
for (const [path, text] of FIXTURES) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), `${text}\n`);
}

after(() => rmSync(root, { recursive: true, force: true }));

const selectionFor = ({ graph, path }) => relatedSelection({ graph, changed: [path] });

describe('specifiersOf', () => {
  it('reads static, side effect, dynamic and mocked imports and drops a query', () => {
    const source = [
      "import { a } from './a';",
      "export { b } from '../b';",
      "import './c.css?raw';",
      "const d = await import('./d');",
      "vi.mock('../e', () => ({}));",
      "const f = await vi.importActual<typeof import('./f')>('./f');",
    ].join('\n');
    const expected = ['../b', '../e', './a', './c.css', './d', './f'];
    assert.deepEqual(specifiersOf({ source }).sort(), expected.sort());
  });
});

describe('globMatchesOf', () => {
  it('matches the included pattern and drops the negated one', () => {
    const files = ['src/scenes/u1/a.tsx', 'src/scenes/u1/a.test.tsx', 'src/scenes/base/b.tsx'];
    const source = "import.meta.glob(['./scenes/u*/*.tsx', '!./scenes/u*/*.test.tsx'])";
    const matches = globMatchesOf({ source, from: 'src/registry.ts', files });
    assert.deepEqual(matches, ['src/scenes/u1/a.tsx']);
  });
});

describe('relatedSelection', () => {
  const graph = buildGraph({ root });

  it('follows a package export into the app and a glob into a registry', () => {
    const selection = selectionFor({ graph, path: 'packages/core/src/slug/branchName.ts' });
    assert.ok(selection.desktop.includes('src/features/branch/label.test.tsx'));
    assert.ok(selection.desktop.includes('src/app/scenes/u1/board.test.tsx'));
    assert.ok(selection.desktop.includes('src/app/scenes/registry.test.ts'));
    assert.equal(selection.isA11yReached, true);
  });

  it('resolves a wildcard package export', () => {
    const selection = selectionFor({ graph, path: 'packages/core/src/icons/dog.ts' });
    assert.ok(selection.desktop.includes('src/features/icons/dog.test.ts'));
  });

  it('keeps the desktop vite tests that read files from disk', () => {
    const selection = selectionFor({ graph, path: 'apps/desktop/src/features/palette/rank.ts' });
    assert.ok(selection.desktop.includes('vite/demoHtml.test.ts'));
  });

  it('resolves an import that ends in a slash to the folder entry', () => {
    const selection = selectionFor({
      graph,
      path: 'apps/desktop/src/features/board/BoardEmpty/index.tsx',
    });
    assert.ok(selection.desktop.includes('src/features/board/BoardEmpty/index.test.tsx'));
  });

  it('always keeps the regression guards and the tests that read files from disk', () => {
    const selection = selectionFor({ graph, path: 'apps/desktop/src-tauri/src/lib.rs' });
    assert.deepEqual(selection.desktop.sort(), [
      'src/__tests__/regressions/rules.test.ts',
      'src/shared/readsDocs.test.ts',
      'vite/demoHtml.test.ts',
    ]);
    assert.equal(selection.isA11yReached, false);
  });

  it('counts a mocked module as a dependency and leaves the perf and a11y projects out', () => {
    const selection = selectionFor({ graph, path: 'apps/desktop/src/features/palette/rank.ts' });
    const isOtherProject = (file) => file.includes('.perf.') || file.includes('/a11y/');
    assert.ok(selection.desktop.includes('src/features/palette/rank.test.ts'));
    assert.ok(!selection.desktop.some(isOtherProject));
    assert.equal(selection.isA11yReached, false);
  });

  it('selects the package tests a change reaches, by package', () => {
    const selection = selectionFor({ graph, path: 'packages/core/src/slug/branchName.ts' });
    assert.deepEqual(selection.packages, { core: ['src/slug/branchName.test.ts'] });
    const unrelated = selectionFor({ graph, path: 'packages/core/src/icons/dog.ts' });
    assert.deepEqual(unrelated.packages, {});
  });

  it('prints one line per test with its package for the quick gate', () => {
    const selection = selectionFor({ graph, path: 'packages/core/src/slug/branchName.ts' });
    const lines = selectionLines({ selection });
    assert.ok(lines.includes('desktop src/features/branch/label.test.tsx'));
    assert.ok(lines.includes('desktop src/__tests__/regressions/rules.test.ts'));
    assert.ok(lines.includes('core src/slug/branchName.test.ts'));
  });

  it('records an import it cannot resolve instead of dropping it silently', () => {
    assert.ok(graph.unresolved.some(({ specifier }) => specifier === './MockScene/'));
  });
});

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DESKTOP_SHARDS,
  MAX_RELATED_PATHS,
  isInertPath,
  lintScopeOf,
  shouldRunTests,
  testPlanOf,
  testScopeOf,
} from './ci-changes.mjs';

const shouldRunTestsForPullRequest = ({ paths }) =>
  shouldRunTests({ eventName: 'pull_request', paths });

describe('shouldRunTests', () => {
  it('runs everything on a push to main', () => {
    assert.equal(shouldRunTests({ eventName: 'push', paths: ['docs/testing.md'] }), true);
    assert.equal(shouldRunTests({ eventName: 'push', paths: [] }), true);
  });

  it('skips the tests when every changed path is inert', () => {
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['docs/testing.md', 'docs/readme/hero.png'] }),
      false,
    );
    assert.equal(
      shouldRunTestsForPullRequest({
        paths: ['website/src/pages/index.astro', 'website/public/a.webp'],
      }),
      false,
    );
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['.github/contributor-akhayam99.png'] }),
      false,
    );
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['.github/pull_request_template.md'] }),
      false,
    );
  });

  it('runs the tests when one changed path is not inert', () => {
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['docs/testing.md', 'apps/desktop/src/main.tsx'] }),
      true,
    );
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['website/src/a.astro', 'packages/db/src/index.ts'] }),
      true,
    );
  });

  it('treats markdown that code reads as code', () => {
    assert.equal(shouldRunTestsForPullRequest({ paths: ['CHANGELOG.md'] }), true);
    assert.equal(shouldRunTestsForPullRequest({ paths: ['FEATURES.md'] }), true);
    assert.equal(shouldRunTestsForPullRequest({ paths: ['docs/features/workflows.md'] }), true);
    assert.equal(shouldRunTestsForPullRequest({ paths: ['README.md'] }), true);
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['docs/changelog/0.13.1/hero.webp'] }),
      true,
    );
    assert.equal(shouldRunTestsForPullRequest({ paths: ['docs/changelog/README.md'] }), true);
  });

  it('treats workflows and actions as code', () => {
    assert.equal(shouldRunTestsForPullRequest({ paths: ['.github/workflows/ci.yml'] }), true);
    assert.equal(shouldRunTestsForPullRequest({ paths: ['.github/workflows/release.yml'] }), true);
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['.github/actions/setup-workspace/action.yml'] }),
      true,
    );
    assert.equal(shouldRunTestsForPullRequest({ paths: ['.github/dependabot.yml'] }), true);
  });

  it('runs the tests when the diff is empty or unreadable', () => {
    assert.equal(shouldRunTestsForPullRequest({ paths: [] }), true);
    assert.equal(shouldRunTestsForPullRequest({ paths: null }), true);
  });

  it('does not let a look-alike path pass as inert', () => {
    assert.equal(shouldRunTestsForPullRequest({ paths: ['apps/desktop/docs/notes.md'] }), true);
    assert.equal(shouldRunTestsForPullRequest({ paths: ['docsx/a.md'] }), true);
    assert.equal(shouldRunTestsForPullRequest({ paths: ['.github/nested/a.png'] }), true);
  });
});

const scopeForPullRequest = ({ paths }) => testScopeOf({ eventName: 'pull_request', paths });

describe('testScopeOf', () => {
  it('runs the full suite on main, on a merge group and on an unreadable diff', () => {
    const leaf = ['apps/desktop/src/features/palette/rank.ts'];
    assert.equal(testScopeOf({ eventName: 'push', paths: leaf }), 'full');
    assert.equal(testScopeOf({ eventName: 'merge_group', paths: leaf }), 'full');
    assert.equal(scopeForPullRequest({ paths: null }), 'full');
    assert.equal(scopeForPullRequest({ paths: [] }), 'full');
  });

  it('runs nothing when every path is inert', () => {
    assert.equal(scopeForPullRequest({ paths: ['docs/testing.md'] }), 'none');
  });

  it('runs the related tests for source files of the app, the packages and the Rust crate', () => {
    assert.equal(
      scopeForPullRequest({
        paths: [
          'apps/desktop/src/features/palette/rank.ts',
          'packages/core/src/slug/branchName.ts',
          'apps/desktop/src-tauri/src/lib.rs',
          'docs/testing.md',
        ],
      }),
      'related',
    );
  });

  it('runs everything when a path touches shared config, scripts, workflows or guards', () => {
    const touchesEverything = [
      'pnpm-lock.yaml',
      'package.json',
      'apps/desktop/package.json',
      'turbo.json',
      'tsconfig.base.json',
      'eslint.config.mjs',
      'eslint-suppressions.json',
      '.github/workflows/ci.yml',
      '.github/actions/setup-workspace/action.yml',
      'scripts/ci-changes.mjs',
      'apps/desktop/vitest.config.ts',
      'apps/desktop/src/__tests__/regressions/forbidden-patterns.test.ts',
      'apps/desktop/src/test/failOnConsole.ts',
      'packages/core/src/test/hostileSweep.ts',
      'apps/desktop/src/test/console-baseline.json',
      'apps/desktop/src/app/components/MockScene/scenes.txt',
      'apps/desktop/src/styles/tokens.css',
      'CHANGELOG.md',
      'docs/features/board.md',
    ];
    for (const path of touchesEverything) {
      assert.equal(
        scopeForPullRequest({ paths: ['apps/desktop/src/features/palette/rank.ts', path] }),
        'full',
        path,
      );
    }
  });

  it('runs everything when more files changed than a related run is worth', () => {
    const many = Array.from(
      { length: MAX_RELATED_PATHS + 1 },
      (_, index) => `apps/desktop/src/features/palette/file${index}.ts`,
    );
    assert.equal(scopeForPullRequest({ paths: many }), 'full');
    assert.equal(scopeForPullRequest({ paths: many.slice(1) }), 'related');
  });
});

describe('lintScopeOf', () => {
  it('lints the whole tree off a pull request and when shared config changed', () => {
    assert.equal(lintScopeOf({ eventName: 'push', paths: [] }), 'all');
    assert.equal(
      lintScopeOf({ eventName: 'pull_request', paths: ['eslint-suppressions-strict.json'] }),
      'all',
    );
    assert.equal(lintScopeOf({ eventName: 'pull_request', paths: null }), 'all');
  });

  it('lints the changed files of a narrow change, website and docs included', () => {
    assert.equal(
      lintScopeOf({
        eventName: 'pull_request',
        paths: ['apps/desktop/src/features/palette/rank.ts', 'website/src/pages/index.tsx'],
      }),
      'changed',
    );
    assert.equal(lintScopeOf({ eventName: 'pull_request', paths: ['docs/testing.md'] }), 'changed');
  });
});

describe('testPlanOf', () => {
  const selection = ({ desktop, zones = 1, isA11yReached = true }) => ({
    desktop: Array.from({ length: desktop }, (_, index) => `src/t${index}.test.ts`),
    desktopTotal: 600,
    zones: Array.from({ length: zones }, (_, index) => `src/z${index}.test.ts`),
    isA11yReached,
    packages: [],
  });

  it('keeps six shards for a full run', () => {
    const plan = testPlanOf({ scope: 'full', selection: null });
    assert.equal(plan.desktopShards.length, DESKTOP_SHARDS);
    assert.deepEqual([plan.tests, plan.zones, plan.a11y], [true, true, true]);
  });

  it('turns every test job off when nothing runs', () => {
    const plan = testPlanOf({ scope: 'none', selection: null });
    assert.deepEqual([plan.tests, plan.zones, plan.a11y], [false, false, false]);
  });

  it('gives a related run one shard per full shard of work', () => {
    assert.deepEqual(
      testPlanOf({ scope: 'related', selection: selection({ desktop: 40 }) }).desktopShards,
      ['1/1'],
    );
    assert.deepEqual(
      testPlanOf({ scope: 'related', selection: selection({ desktop: 250 }) }).desktopShards,
      ['1/3', '2/3', '3/3'],
    );
  });

  it('falls back to the full run when the related tests are more than half the suite', () => {
    assert.equal(
      testPlanOf({ scope: 'related', selection: selection({ desktop: 301 }) }).scope,
      'full',
    );
  });

  it('skips the time zones and a11y only when no related test needs them', () => {
    const plan = testPlanOf({
      scope: 'related',
      selection: selection({ desktop: 10, zones: 0, isA11yReached: false }),
    });
    assert.deepEqual([plan.zones, plan.a11y], [false, false]);
  });
});

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARDED_ROOTS = new Set(['website', 'docs']);

const collectTestFiles = ({ directory }) => {
  if (!existsSync(directory)) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        files.push(...collectTestFiles({ directory: path }));
      }
      continue;
    }
    if (/\.test\.tsx?$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
};

const collectReferencedPaths = ({ source, file }) => {
  const referenced = [];
  for (const call of source.matchAll(/\b(?:join|resolve)\(([^()]*)\)/g)) {
    const literals = [...call[1].matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)].map(
      (match) => match[1] ?? match[2],
    );
    const start = literals.findIndex((literal) => GUARDED_ROOTS.has(literal.split('/')[0]));
    if (start === -1) {
      continue;
    }
    referenced.push(literals.slice(start).join('/'));
  }
  for (const call of source.matchAll(
    /new URL\(\s*(?:'([^'\n]*)'|"([^"\n]*)")\s*,\s*import\.meta\.url/g,
  )) {
    const target = relative(REPOSITORY_ROOT, resolve(dirname(file), call[1] ?? call[2]));
    if (GUARDED_ROOTS.has(target.split('/')[0])) {
      referenced.push(target);
    }
  }
  return referenced;
};

const collectPathsReadByTests = () => {
  const roots = [
    join(REPOSITORY_ROOT, 'apps', 'desktop', 'src'),
    ...readdirSync(join(REPOSITORY_ROOT, 'packages')).map((name) =>
      join(REPOSITORY_ROOT, 'packages', name, 'src'),
    ),
  ];
  const found = new Map();
  for (const file of roots.flatMap((directory) => collectTestFiles({ directory }))) {
    for (const path of collectReferencedPaths({ source: readFileSync(file, 'utf8'), file })) {
      found.set(path, [...(found.get(path) ?? []), relative(REPOSITORY_ROOT, file)]);
    }
  }
  return found;
};

describe('paths that tests read from website and docs', () => {
  it('finds the reads this guard is about', () => {
    const paths = [...collectPathsReadByTests().keys()];
    assert.ok(paths.includes('website/src/styles/base.css'), paths.join('\n'));
    assert.ok(paths.includes('docs/changelog'), paths.join('\n'));
    assert.ok(paths.includes('docs/architecture.md'), paths.join('\n'));
  });

  it('reads a path given to new URL next to import.meta.url', () => {
    const source =
      "const DOC = fileURLToPath(new URL('../../../../docs/architecture.md', import.meta.url));";
    const file = join(REPOSITORY_ROOT, 'packages', 'db', 'src', 'migrations', 'a.test.ts');
    assert.deepEqual(collectReferencedPaths({ source, file }), ['docs/architecture.md']);
  });

  it('never classifies a path a test reads as inert', () => {
    const offenders = [];
    for (const [path, files] of collectPathsReadByTests()) {
      const probe = path.split('/').at(-1).includes('.') ? path : `${path}/probe.txt`;
      if (isInertPath({ path: probe })) {
        offenders.push(`${path} (read by ${files.join(', ')})`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('keeps the rest of website and docs inert', () => {
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['website/src/pages/index.astro', 'docs/testing.md'] }),
      false,
    );
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['website/src/components/Logo.tsx'] }),
      true,
    );
    assert.equal(shouldRunTestsForPullRequest({ paths: ['website/src/styles/base.css'] }), true);
    assert.equal(shouldRunTestsForPullRequest({ paths: ['website/public/favicon.svg'] }), true);
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['website/scripts/brand-assets/tileMetrics.mjs'] }),
      true,
    );
    assert.equal(shouldRunTestsForPullRequest({ paths: ['docs/changelog'] }), true);
    assert.equal(shouldRunTestsForPullRequest({ paths: ['docs/architecture.md'] }), true);
  });
});

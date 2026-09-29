import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { shouldRunTests, isInertPath } from './ci-changes.mjs';

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

const collectReferencedPaths = ({ source }) => {
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
    for (const path of collectReferencedPaths({ source: readFileSync(file, 'utf8') })) {
      found.set(path, [...(found.get(path) ?? []), relative(REPOSITORY_ROOT, file)]);
    }
  }
  return found;
};

describe('paths that tests read from website and docs', () => {
  it('finds the reads this guard is about', () => {
    const paths = [...collectPathsReadByTests().keys()];
    assert.ok(paths.includes('website/src/styles.css'), paths.join('\n'));
    assert.ok(paths.includes('docs/changelog'), paths.join('\n'));
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
    assert.equal(shouldRunTestsForPullRequest({ paths: ['website/src/styles.css'] }), true);
    assert.equal(shouldRunTestsForPullRequest({ paths: ['website/public/favicon.svg'] }), true);
    assert.equal(
      shouldRunTestsForPullRequest({ paths: ['website/scripts/build-brand-assets.mjs'] }),
      true,
    );
    assert.equal(shouldRunTestsForPullRequest({ paths: ['docs/changelog'] }), true);
  });
});

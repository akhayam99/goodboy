import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideTests } from './ci-changes.mjs';

const pullRequest = (paths) => decideTests({ eventName: 'pull_request', paths });

describe('decideTests', () => {
  it('runs everything on a push to main', () => {
    assert.equal(decideTests({ eventName: 'push', paths: ['docs/testing.md'] }), true);
    assert.equal(decideTests({ eventName: 'push', paths: [] }), true);
  });

  it('skips the tests when every changed path is inert', () => {
    assert.equal(pullRequest(['docs/testing.md', 'docs/readme/hero.png']), false);
    assert.equal(pullRequest(['website/src/pages/index.astro', 'website/public/a.webp']), false);
    assert.equal(pullRequest(['.github/contributor-akhayam99.png']), false);
    assert.equal(pullRequest(['.github/pull_request_template.md']), false);
  });

  it('runs the tests when one changed path is not inert', () => {
    assert.equal(pullRequest(['docs/testing.md', 'apps/desktop/src/main.tsx']), true);
    assert.equal(pullRequest(['website/src/a.astro', 'packages/db/src/index.ts']), true);
  });

  it('treats markdown that code reads as code', () => {
    assert.equal(pullRequest(['CHANGELOG.md']), true);
    assert.equal(pullRequest(['FEATURES.md']), true);
    assert.equal(pullRequest(['README.md']), true);
    assert.equal(pullRequest(['docs/changelog/0.13.1/hero.webp']), true);
    assert.equal(pullRequest(['docs/changelog/README.md']), true);
  });

  it('treats workflows and actions as code', () => {
    assert.equal(pullRequest(['.github/workflows/ci.yml']), true);
    assert.equal(pullRequest(['.github/workflows/release.yml']), true);
    assert.equal(pullRequest(['.github/actions/setup-workspace/action.yml']), true);
    assert.equal(pullRequest(['.github/dependabot.yml']), true);
  });

  it('runs the tests when the diff is empty or unreadable', () => {
    assert.equal(pullRequest([]), true);
    assert.equal(pullRequest(null), true);
  });

  it('does not let a look-alike path pass as inert', () => {
    assert.equal(pullRequest(['apps/desktop/docs/notes.md']), true);
    assert.equal(pullRequest(['docsx/a.md']), true);
    assert.equal(pullRequest(['.github/nested/a.png']), true);
  });
});

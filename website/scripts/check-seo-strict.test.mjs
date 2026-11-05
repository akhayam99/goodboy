import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runCheckSeo } from './lib/miniDist.mjs';

const HOME = {
  path: '/',
  title: 'Acme: a tool for running agents on one task',
  description:
    'Acme runs several coding agents on one task, with a git worktree per branch, shared context and a review step before anything merges.',
};

const SHORT = {
  ...HOME,
  path: '/docs',
  title: 'Acme',
  description: `${HOME.description} More.`,
};

describe('check-seo exit status', () => {
  it('passes a clean site', () => {
    assert.equal(runCheckSeo({ pages: [HOME] }).status, 0);
  });

  it('lets a grown warning pass without --strict and says so', () => {
    const { status, output } = runCheckSeo({ pages: [HOME, SHORT] });
    assert.equal(status, 0);
    assert.match(output, /warnings grew/);
  });

  it('fails a grown warning with --strict', () => {
    const { status, output } = runCheckSeo({ pages: [HOME, SHORT], args: ['--strict'] });
    assert.equal(status, 1);
    assert.match(output, /title-length/);
  });

  it('fails a structural error without --strict', () => {
    const { status } = runCheckSeo({ pages: [HOME, { ...HOME, path: '/docs' }] });
    assert.equal(status, 1);
  });
});

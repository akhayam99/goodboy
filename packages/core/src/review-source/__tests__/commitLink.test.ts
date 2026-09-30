import { describe, expect, it } from 'vitest';
import { commitLinkOf } from '../commitLink';

describe('commitLinkOf', () => {
  it('links the commit for each source and stays linear on repeated segments', () => {
    expect(commitLinkOf({ kind: 'github', url: 'https://github.com/a/b/pull/12', sha: 's' })).toBe(
      'https://github.com/a/b/commit/s',
    );
    expect(
      commitLinkOf({ kind: 'github', url: 'https://github.com/a/b/pull/12/files', sha: 's' }),
    ).toBe('https://github.com/a/b/commit/s');
    expect(commitLinkOf({ kind: 'github', url: 'https://github.com/a/b/pull/x', sha: 's' })).toBe(
      null,
    );
    expect(commitLinkOf({ kind: 'github', url: 'https://github.com/a/b/pull/12x', sha: 's' })).toBe(
      null,
    );
    expect(
      commitLinkOf({ kind: 'gitlab', url: 'https://gl.com/a/b/-/merge_requests/3', sha: 's' }),
    ).toBe('https://gl.com/a/b/-/commit/s');
    expect(
      commitLinkOf({
        kind: 'bitbucket',
        url: 'https://bitbucket.org/a/b/pull-requests/7/overview',
        sha: 's',
      }),
    ).toBe('https://bitbucket.org/a/b/commits/s');
    expect(commitLinkOf({ kind: 'github', url: '/pull/0/'.repeat(50000), sha: 's' })).toBe(
      '/commit/s',
    );
  });
});

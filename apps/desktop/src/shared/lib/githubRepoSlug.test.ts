import { describe, expect, it } from 'vitest';
import { githubRepoSlug } from './githubRepoSlug';

describe('githubRepoSlug', () => {
  it('reads the slug out of a pull request url', () => {
    expect(githubRepoSlug('https://github.com/acme/web/pull/41')).toBe('acme/web');
  });

  it('reads the slug out of a comment anchor', () => {
    expect(githubRepoSlug('https://github.com/acme/web/pull/41#discussion_r1')).toBe('acme/web');
  });

  it('returns an empty slug when there is no url to read', () => {
    expect(githubRepoSlug(null)).toBe('');
    expect(githubRepoSlug('not a url')).toBe('');
  });
});

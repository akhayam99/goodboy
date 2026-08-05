import { describe, expect, it } from 'vitest';
import { bitbucketRepoSlug } from './bitbucketRepoSlug';

describe('bitbucketRepoSlug', () => {
  it('takes the repository name off a workspace path', () => {
    expect(bitbucketRepoSlug({ projectPath: 'acme/rocket' })).toBe('rocket');
  });

  it('takes the last segment of a nested project path', () => {
    expect(bitbucketRepoSlug({ projectPath: 'acme/group/rocket' })).toBe('rocket');
  });

  it('gives up on an empty or missing path', () => {
    expect(bitbucketRepoSlug({ projectPath: null })).toBeNull();
    expect(bitbucketRepoSlug({ projectPath: '' })).toBeNull();
    expect(bitbucketRepoSlug({ projectPath: '/' })).toBeNull();
  });
});

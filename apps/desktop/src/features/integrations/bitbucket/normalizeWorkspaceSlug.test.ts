import { describe, expect, it } from 'vitest';
import { normalizeWorkspaceSlug } from './normalizeWorkspaceSlug';

describe('normalizeWorkspaceSlug', () => {
  it('lowercases and trims a bare slug', () => {
    expect(normalizeWorkspaceSlug({ input: '  GoodBoy  ' })).toBe('goodboy');
  });

  it('takes the slug out of a pasted repository url', () => {
    expect(normalizeWorkspaceSlug({ input: 'https://bitbucket.org/goodboy/desktop' })).toBe(
      'goodboy',
    );
    expect(normalizeWorkspaceSlug({ input: 'bitbucket.org/goodboy' })).toBe('goodboy');
  });

  it('is empty for an empty input', () => {
    expect(normalizeWorkspaceSlug({ input: '   ' })).toBe('');
  });
});

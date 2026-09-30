import { describe, expect, it } from 'vitest';
import { threadFixSha } from './threadFixSha';

describe('threadFixSha', () => {
  it('reads the last commit of the thread', () => {
    expect(threadFixSha({ commitShas: ['c81e5aa', 'e31b9f4'] })).toBe('e31b9f4');
  });

  it('prefers the remapped thread commit over a stale integrated sha', () => {
    expect(threadFixSha({ commitShas: ['e31b9f4'], integratedSha: 'c81e5aa' })).toBe('e31b9f4');
  });

  it('falls back to the integrated sha, then to nothing', () => {
    expect(threadFixSha({ commitShas: [], integratedSha: 'c81e5aa' })).toBe('c81e5aa');
    expect(threadFixSha({ commitShas: null })).toBeNull();
  });
});

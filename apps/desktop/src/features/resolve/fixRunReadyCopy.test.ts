// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { applyAndResolveLabel } from './commentProjection';
import { fixRunReadyBody, fixRunReadyTitle } from './fixRunReadyCopy';

describe('fix run ready copy', () => {
  it('counts the fixes in the title', () => {
    expect(fixRunReadyTitle({ count: 4 })).toBe('Fix run finished: 4 fixes ready for you');
    expect(fixRunReadyTitle({ count: 1 })).toBe('Fix run finished: 1 fix ready for you');
  });

  it('names the commit and what the next push does', () => {
    expect(
      fixRunReadyBody({
        ready: { threadIds: ['a', 'b'], commits: ['90b1d57'], hostThreadCount: 2 },
        provider: 'GitHub',
        canResolve: true,
      }),
    ).toBe(
      'Apply accepts the fix made in 90b1d57. The next push sends it and replies to and resolves the 2 threads on GitHub.',
    );
  });

  it('does not promise a resolve where the host cannot, and skips threads for notes', () => {
    expect(
      fixRunReadyBody({
        ready: { threadIds: ['a'], commits: ['90b1d57', 'a1b2c3d'], hostThreadCount: 1 },
        provider: 'Bitbucket',
        canResolve: false,
      }),
    ).toBe(
      'Apply accepts the fixes made in 2 commits. The next push sends it and replies to the thread on Bitbucket.',
    );
    expect(
      fixRunReadyBody({
        ready: { threadIds: ['a'], commits: ['90b1d57'], hostThreadCount: 0 },
        provider: 'GitHub',
        canResolve: true,
      }),
    ).toBe('Apply accepts the fix made in 90b1d57. The next push sends it.');
  });

  it('labels the button with the count', () => {
    expect(applyAndResolveLabel({ count: 4 })).toBe('Apply and resolve 4');
  });
});

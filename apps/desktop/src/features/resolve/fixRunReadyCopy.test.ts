// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { applyFixesLabel } from './commentProjection';
import { fixRunReadyBody, fixRunReadyTitle } from './fixRunReadyCopy';

describe('fix run ready copy', () => {
  it('counts the fixes in the title', () => {
    expect(fixRunReadyTitle({ count: 4 })).toBe('Fix run finished: 4 fixes ready for you');
    expect(fixRunReadyTitle({ count: 1 })).toBe('Fix run finished: 1 fix ready for you');
  });

  it('names the commit and what the next push does', () => {
    expect(
      fixRunReadyBody({
        ready: {
          threadIds: ['a', 'b'],
          commits: ['90b1d57'],
          hostThreadCount: 2,
          isLandingUncommitted: false,
        },
        provider: 'GitHub',
        canResolve: true,
      }),
    ).toBe(
      'Apply accepts the fix made in 90b1d57. The next push sends it and replies to and resolves the 2 comments on GitHub.',
    );
  });

  it('does not promise a resolve where the host cannot, and skips comments for notes', () => {
    expect(
      fixRunReadyBody({
        ready: {
          threadIds: ['a'],
          commits: ['90b1d57', 'a1b2c3d'],
          hostThreadCount: 1,
          isLandingUncommitted: false,
        },
        provider: 'Bitbucket',
        canResolve: false,
      }),
    ).toBe(
      'Apply accepts the fixes made in 2 commits. The next push sends it and replies to the comment on Bitbucket.',
    );
    expect(
      fixRunReadyBody({
        ready: {
          threadIds: ['a'],
          commits: ['90b1d57'],
          hostThreadCount: 0,
          isLandingUncommitted: false,
        },
        provider: 'GitHub',
        canResolve: true,
      }),
    ).toBe('Apply accepts the fix made in 90b1d57. The next push sends it.');
  });

  it('says a note fix lands uncommitted in the working tree and is never pushed', () => {
    expect(
      fixRunReadyBody({
        ready: {
          threadIds: ['note:harborline-header'],
          commits: ['90b1d57'],
          hostThreadCount: 0,
          isLandingUncommitted: true,
        },
        provider: 'GitHub',
        canResolve: true,
      }),
    ).toBe(
      'Apply writes the fix made in 90b1d57 into your working tree as uncommitted changes, next to your own. Nothing is committed or pushed.',
    );
    expect(
      fixRunReadyBody({
        ready: {
          threadIds: ['note:harborline-header', 'PRRT_ledger-core'],
          commits: ['90b1d57'],
          hostThreadCount: 1,
          isLandingUncommitted: true,
        },
        provider: 'GitHub',
        canResolve: true,
      }),
    ).toBe(
      'Apply writes the fix made in 90b1d57 into your working tree as uncommitted changes, next to your own. Commit it yourself, then the next push sends it and replies to and resolves the comment on GitHub.',
    );
  });

  it('labels the Apply step with the count', () => {
    expect(applyFixesLabel({ count: 4 })).toBe('Apply 4 fixes');
    expect(applyFixesLabel({ count: 1 })).toBe('Apply fix');
  });
});

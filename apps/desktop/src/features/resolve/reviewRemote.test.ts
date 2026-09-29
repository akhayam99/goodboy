import { describe, expect, it } from 'vitest';
import type { ThreadGitFacts } from '../../store/slices/resolve/threadGitState';
import { commitUrlOf, remoteOf, replyOnlyLine } from './reviewRemote';

const facts = (overrides: Partial<ThreadGitFacts>): ThreadGitFacts => ({
  gitState: 'local',
  onOrigin: null,
  elsewhere: null,
  missing: null,
  userReply: null,
  ...overrides,
});

describe('remoteOf', () => {
  it('reads the overlay off the git facts', () => {
    expect(remoteOf({ state: 'accepted', facts: facts({ gitState: 'on_origin' }) })).toBe(
      'on_origin',
    );
    expect(remoteOf({ state: 'ready', facts: facts({ gitState: 'fixed_elsewhere' }) })).toBe(
      'looks_fixed',
    );
    expect(remoteOf({ state: 'ready', facts: facts({ gitState: 'missing' }) })).toBe('missing');
  });

  it('lets a hand-written reply win over the git state', () => {
    const replied = facts({
      gitState: 'on_origin',
      userReply: { commentId: 'c2', createdAtMs: 1 },
    });
    expect(remoteOf({ state: 'accepted', facts: replied })).toBe('you_replied');
  });

  it('stays quiet for local threads and for threads that are settled or being drafted', () => {
    expect(remoteOf({ state: 'ready', facts: facts({}) })).toBeNull();
    expect(remoteOf({ state: 'ready', facts: null })).toBeNull();
    const onOrigin = facts({ gitState: 'on_origin' });
    expect(remoteOf({ state: 'pushed', facts: onOrigin })).toBeNull();
    expect(remoteOf({ state: 'resolved', facts: onOrigin })).toBeNull();
    expect(remoteOf({ state: 'drafting', facts: onOrigin })).toBeNull();
    expect(remoteOf({ state: 'skipped', facts: onOrigin })).toBeNull();
  });
});

describe('replyOnlyLine', () => {
  it('counts the threads the push leaves to a reply', () => {
    expect(replyOnlyLine({ count: 1 })).toBe('1 more needs only a reply');
    expect(replyOnlyLine({ count: 3 })).toBe('3 more need only a reply');
  });
});

describe('commitUrlOf', () => {
  it('builds the commit link from the pull request link', () => {
    expect(
      commitUrlOf({ prUrl: 'https://github.com/harborline/payments-api/pull/318', sha: 'abc' }),
    ).toBe('https://github.com/harborline/payments-api/commit/abc');
    expect(commitUrlOf({ prUrl: null, sha: 'abc' })).toBeNull();
  });
});

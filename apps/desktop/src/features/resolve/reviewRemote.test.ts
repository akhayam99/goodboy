import { describe, expect, it } from 'vitest';
import type { ThreadGitFacts } from '../../store/slices/resolve/threadGitState';
import { commitUrlOf, remoteOf, remoteViewOf } from './reviewRemote';

const facts = (overrides: Partial<ThreadGitFacts>): ThreadGitFacts => ({
  gitState: 'local',
  onOrigin: null,
  elsewhere: null,
  missing: null,
  folded: null,
  userReply: null,
  verdict: null,
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

describe('commitUrlOf', () => {
  it('builds the commit link from the pull request link', () => {
    expect(
      commitUrlOf({ prUrl: 'https://github.com/harborline/payments-api/pull/318', sha: 'abc' }),
    ).toBe('https://github.com/harborline/payments-api/commit/abc');
    expect(commitUrlOf({ prUrl: null, sha: 'abc' })).toBeNull();
  });
});

describe('a fix that went missing', () => {
  it('shows a pushed row only when origin lost its commit', () => {
    const lost = facts({
      gitState: 'missing',
      missing: { sha: 'abc', wasPushed: true, isPathGone: false },
    });
    const local = facts({
      gitState: 'missing',
      missing: { sha: 'abc', wasPushed: false, isPathGone: false },
    });
    expect(remoteOf({ state: 'pushed', facts: lost })).toBe('missing');
    expect(remoteOf({ state: 'pushed', facts: local })).toBeNull();
  });

  it('words the row by its check, then by its verdict', () => {
    const verdict = (kind: 'fixed_elsewhere' | 'obsolete' | 'refix') => ({
      kind,
      evidence: 'e',
      sha: null,
      checkedAt: 1,
    });
    expect(remoteViewOf({ remote: 'missing', verdict: null, isChecking: false }).word).toBe(
      'Fix went missing',
    );
    expect(remoteViewOf({ remote: 'missing', verdict: null, isChecking: true }).word).toBe(
      'Checking',
    );
    expect(
      remoteViewOf({ remote: 'missing', verdict: verdict('fixed_elsewhere'), isChecking: false })
        .word,
    ).toBe('Already fixed here');
    expect(
      remoteViewOf({ remote: 'missing', verdict: verdict('obsolete'), isChecking: false }).word,
    ).toBe('No longer relevant');
    expect(
      remoteViewOf({ remote: 'missing', verdict: verdict('refix'), isChecking: false }).word,
    ).toBe('Still needed');
    expect(remoteViewOf({ remote: 'folded', verdict: null, isChecking: false }).word).toBe(
      'Folded in',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { isRemoteMovedError, remoteCarriesWorkError, remoteMovedError } from './remoteMovedError';

describe('isRemoteMovedError', () => {
  it('recognizes the two messages of the verified push', () => {
    expect(
      isRemoteMovedError({
        error: remoteMovedError({ branch: 'hl/fix', remote: 'abcdef1234', reviewed: '1234567890' }),
      }),
    ).toBe(true);
    expect(
      isRemoteMovedError({
        error: remoteCarriesWorkError({ branch: 'hl/fix', local: 'abcdef1234' }),
      }),
    ).toBe(true);
  });

  it('recognizes a git rejection and leaves other failures alone', () => {
    expect(isRemoteMovedError({ error: '! [rejected] hl/fix -> hl/fix (fetch first)' })).toBe(true);
    expect(isRemoteMovedError({ error: 'no worktree resolved for this mount to push from' })).toBe(
      false,
    );
    expect(isRemoteMovedError({ error: null })).toBe(false);
  });

  it('keeps the text the push used to say', () => {
    expect(remoteMovedError({ branch: 'hl/fix', remote: 'abcdef1234', reviewed: null })).toBe(
      'hl/fix on the remote is at abcdef1, not the nothing you reviewed',
    );
  });
});

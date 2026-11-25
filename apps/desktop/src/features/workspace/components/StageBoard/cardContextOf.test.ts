import { describe, expect, it } from 'vitest';
import { cardContextOf } from './cardContextOf';

describe('cardContextOf', () => {
  it('names the repository and its branch', () => {
    expect(cardContextOf({ mounts: [{ mountName: 'payments-api', branch: 'ak/retry' }] })).toBe(
      'payments-api · ak/retry',
    );
  });

  it('counts the other repositories and keeps the first branch', () => {
    expect(
      cardContextOf({
        mounts: [
          { mountName: 'payments-api', branch: 'ak/retry' },
          { mountName: 'ledger-core', branch: 'ak/ledger' },
        ],
      }),
    ).toBe('payments-api +1 · ak/retry');
  });

  it('says only the folder when it has no branch', () => {
    expect(cardContextOf({ mounts: [{ mountName: 'notes', branch: '' }] })).toBe('notes');
  });

  it('is empty for a session with no repository', () => {
    expect(cardContextOf({ mounts: [] })).toBe('');
  });
});

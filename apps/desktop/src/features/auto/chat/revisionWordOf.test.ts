import { describe, expect, it } from 'vitest';
import { revisionWordOf } from './revisionWordOf';
import { settledStatusOf } from './settledStatusOf';

const DONE = settledStatusOf({ outcome: 'completed' });

describe('revisionWordOf', () => {
  it('names a finished revision ready and an open one revising', () => {
    const card = { isRevision: true, reviseVersion: 2, isOpen: false, status: DONE };

    expect(revisionWordOf({ card })).toBe('v2 ready');
    expect(revisionWordOf({ card: { ...card, isOpen: true } })).toBe('revising v2');
    expect(
      revisionWordOf({ card: { ...card, status: settledStatusOf({ outcome: 'failed' }) } }),
    ).toBeNull();
  });

  it('reads the state, so a renamed Done word changes nothing', () => {
    const card = {
      isRevision: true,
      reviseVersion: 3,
      isOpen: false,
      status: { ...DONE, word: 'Finished' },
    };

    expect(revisionWordOf({ card })).toBe('v3 ready');
  });
});

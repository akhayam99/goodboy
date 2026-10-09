import { describe, expect, it } from 'vitest';
import type { ResolveCandidate } from '@goodboy/types';
import type { ResolveCandidateWithItems } from '../../store/slices/resolve/state';
import { laneAcceptCountOf, laneAcceptNotesOf } from './laneAcceptCount';
import { acceptUpToLabel } from './laneCopy';

const entryOf = ({
  id,
  revision,
  baseSha,
  candidateSha,
  itemId,
}: {
  readonly id: string;
  readonly revision: number;
  readonly baseSha: string;
  readonly candidateSha: string;
  readonly itemId: string;
}): ResolveCandidateWithItems => ({
  candidate: {
    id,
    revision,
    baseSha,
    candidateSha,
    worktreePath: '/repo/ledger-core',
    state: 'ready',
  } as ResolveCandidate,
  items: [{ candidateId: id, queueItemId: itemId, itemRevision: 0 }],
});

const CHAIN = [
  entryOf({ id: 'one', revision: 1, baseSha: 'root', candidateSha: 'c1', itemId: 'item-1' }),
  entryOf({ id: 'two', revision: 2, baseSha: 'c1', candidateSha: 'c2', itemId: 'item-2' }),
  entryOf({ id: 'three', revision: 3, baseSha: 'c2', candidateSha: 'c3', itemId: 'item-3' }),
];

describe('laneAcceptCountOf', () => {
  it('counts the fixes accepted together up to a link of the chain', () => {
    expect(laneAcceptCountOf({ candidates: CHAIN, itemId: 'item-1' })).toBe(1);
    expect(laneAcceptCountOf({ candidates: CHAIN, itemId: 'item-3' })).toBe(3);
  });

  it('is one for a comment with no fix in the lane', () => {
    expect(laneAcceptCountOf({ candidates: CHAIN, itemId: 'item-9' })).toBe(1);
  });

  it('counts the notes among the fixes accepted together', () => {
    const noteItemIds = new Set(['item-2']);
    expect(laneAcceptNotesOf({ candidates: CHAIN, itemId: 'item-1', noteItemIds })).toBe(0);
    expect(laneAcceptNotesOf({ candidates: CHAIN, itemId: 'item-3', noteItemIds })).toBe(1);
    expect(laneAcceptNotesOf({ candidates: CHAIN, itemId: 'item-9', noteItemIds })).toBe(0);
  });

  it('labels the single accept plainly and the group by its size', () => {
    expect(acceptUpToLabel({ count: 1 })).toBe('Accept');
    expect(acceptUpToLabel({ count: 3 })).toBe('Accept 3 fixes');
  });

  it('names how many of the fixes in a mixed chain are notes', () => {
    expect(acceptUpToLabel({ count: 3, notes: 1 })).toBe('Accept 3 fixes · 1 is a note');
    expect(acceptUpToLabel({ count: 3, notes: 2 })).toBe('Accept 3 fixes · 2 are notes');
    expect(acceptUpToLabel({ count: 1, notes: 1 })).toBe('Accept');
  });
});

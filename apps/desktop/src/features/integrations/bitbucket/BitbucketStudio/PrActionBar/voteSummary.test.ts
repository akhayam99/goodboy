import { describe, expect, it } from 'vitest';
import type { BitbucketParticipant } from '../../client';
import { voteSummary } from './voteSummary';

const participant = (approved: boolean, state: string | null = null): BitbucketParticipant => ({
  user: null,
  role: 'REVIEWER',
  approved,
  state,
});

describe('voteSummary', () => {
  it('says where I stand and how the room voted, in words', () => {
    const summary = voteSummary({
      participants: [participant(true), participant(true), participant(false, 'changes_requested')],
      vote: 'approved',
    });
    expect(summary).toBe('You approved this pull request. 2 approvals, 1 change request so far');
  });

  it('says nobody voted when the pull request is untouched', () => {
    const summary = voteSummary({ participants: [], vote: 'none' });
    expect(summary).toBe('You have not voted yet. Nobody has voted on it yet');
  });
});

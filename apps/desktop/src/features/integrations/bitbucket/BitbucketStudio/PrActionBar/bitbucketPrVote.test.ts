import { describe, expect, it } from 'vitest';
import type { BitbucketParticipant } from '../../client';
import { bitbucketPrVote } from './bitbucketPrVote';

const participant = (
  overrides: Partial<BitbucketParticipant> & { readonly accountId: string | null },
): BitbucketParticipant => ({
  user: {
    uuid: '{u1}',
    accountId: overrides.accountId,
    nickname: 'kim',
    displayName: 'Kim Lee',
    avatarUrl: null,
  },
  role: 'REVIEWER',
  approved: overrides.approved ?? false,
  state: overrides.state ?? null,
});

describe('bitbucketPrVote', () => {
  it('reads my approval off the participant that matches my account id', () => {
    const vote = bitbucketPrVote({
      participants: [participant({ accountId: 'acc-1', approved: true, state: 'approved' })],
      accountId: 'acc-1',
      displayName: 'Kim Lee',
    });
    expect(vote).toBe('approved');
  });

  it('reads a change request off my participant', () => {
    const vote = bitbucketPrVote({
      participants: [participant({ accountId: 'acc-1', state: 'changes_requested' })],
      accountId: 'acc-1',
      displayName: null,
    });
    expect(vote).toBe('changes-requested');
  });

  it('says unknown when the workspace never recorded who I am', () => {
    const vote = bitbucketPrVote({
      participants: [participant({ accountId: 'acc-1', approved: true })],
      accountId: null,
      displayName: null,
    });
    expect(vote).toBe('unknown');
  });

  it('says none when somebody else voted but I did not', () => {
    const vote = bitbucketPrVote({
      participants: [participant({ accountId: 'acc-2', approved: true })],
      accountId: 'acc-1',
      displayName: 'Kim Lee',
    });
    expect(vote).toBe('none');
  });
});

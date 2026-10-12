import type { ResolveCandidate } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import { describe, expect, it } from 'vitest';
import { pendingCandidateShas } from './pendingCandidateShas';

const candidateOf = ({
  id,
  state,
  candidateSha,
}: {
  readonly id: string;
  readonly state: ResolveCandidate['state'];
  readonly candidateSha: string;
}): ResolveCandidate => ({
  id,
  sessionId: nextSessionId(),
  revision: 1,
  baseSha: 'head-sha',
  candidateSha,
  worktreePath: '/work/acme',
  mountTarget: null,
  state,
  integratedSha: null,
  createdAt: 1,
  updatedAt: 1,
});

describe('pendingCandidateShas', () => {
  it('keeps the head placeholder of a building candidate out of the set', () => {
    const shas = pendingCandidateShas({
      candidates: [candidateOf({ id: 'a', state: 'building', candidateSha: 'head-sha' })],
    });
    expect(shas.has('head-sha')).toBe(false);
  });

  it('includes the captured sha of a ready candidate', () => {
    const shas = pendingCandidateShas({
      candidates: [
        candidateOf({ id: 'a', state: 'building', candidateSha: 'head-sha' }),
        candidateOf({ id: 'b', state: 'ready', candidateSha: 'fix-sha' }),
      ],
    });
    expect([...shas]).toEqual(['fix-sha']);
  });
});

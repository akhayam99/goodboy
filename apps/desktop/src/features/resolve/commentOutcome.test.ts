import { describe, expect, it } from 'vitest';
import type { ResolveStage, ResolveVerdict } from '@goodboy/types';
import { buildItem, buildThread } from '../../app/components/MockScene/scenes/resolveSeed';
import { commentOutcomeOf } from './commentOutcome';

type ShapeParams = {
  readonly stage: ResolveStage;
  readonly disposition?: 'fix' | 'reply' | 'no_change' | null;
  readonly replyDraft?: string | null;
  readonly commitShas?: ReadonlyArray<string>;
  readonly integratedSha?: string | null;
};

const rowOf = ({
  stage,
  disposition = null,
  replyDraft = null,
  commitShas,
  integratedSha = null,
}: ShapeParams) => ({
  thread: {
    ...buildThread({
      threadId: 'PRRT_triage',
      state: 'open',
      stage,
      revision: 1,
      activeAttemptId: null,
      disposition,
      replyDraft,
      question: null,
      createdMinutesAgo: 10,
    }),
    ...(commitShas !== undefined && { commitShas }),
  },
  item: buildItem({
    id: 'item-triage',
    threadId: 'PRRT_triage',
    approvalState: 'none',
    approvedRevision: null,
    deferredAt: null,
    deliveredAt: null,
    candidateRevision: 1,
    createdMinutesAgo: 10,
    integratedSha,
  }),
});

const QUESTION = { text: 'Keep the constant in retryPolicy.ts?' };

const OBSOLETE: ResolveVerdict = {
  kind: 'obsolete',
  evidence: 'removed',
  sha: '6b0e9f1aa',
  checkedAt: 1,
};
const ELSEWHERE: ResolveVerdict = {
  kind: 'fixed_elsewhere',
  evidence: 'folded in',
  sha: 'e31b9f4aa',
  checkedAt: 1,
};
const REFIX: ResolveVerdict = { kind: 'refix', evidence: 'back', sha: null, checkedAt: 1 };

describe('commentOutcomeOf', () => {
  it('maps a new thread to waiting', () => {
    expect(commentOutcomeOf({ ...rowOf({ stage: 'new' }), question: null })).toEqual({
      kind: 'waiting',
    });
  });

  it('maps a working or publishing thread to working', () => {
    expect(commentOutcomeOf({ ...rowOf({ stage: 'working' }), question: null })?.kind).toBe(
      'working',
    );
    expect(commentOutcomeOf({ ...rowOf({ stage: 'publishing' }), question: null })?.kind).toBe(
      'working',
    );
  });

  it('maps a proposed fix that is not integrated to fix-proposed', () => {
    expect(
      commentOutcomeOf({ ...rowOf({ stage: 'proposed', disposition: 'fix' }), question: null }),
    ).toEqual({ kind: 'fix-proposed' });
    expect(
      commentOutcomeOf({
        ...rowOf({ stage: 'proposed', commitShas: ['abc1234def'] }),
        question: null,
      }),
    ).toEqual({ kind: 'fix-proposed' });
  });

  it('maps an integrated fix to fixed with the short sha', () => {
    expect(
      commentOutcomeOf({
        ...rowOf({ stage: 'approved', integratedSha: '9e4c1a7f00d1' }),
        question: null,
      }),
    ).toEqual({ kind: 'fixed', sha: '9e4c1a7' });
    expect(
      commentOutcomeOf({
        ...rowOf({ stage: 'approved', commitShas: ['9e4c1a7f00d1'] }),
        question: null,
      }),
    ).toEqual({ kind: 'fixed', sha: '9e4c1a7' });
  });

  it('keeps an approved thread with no commit as working', () => {
    expect(commentOutcomeOf({ ...rowOf({ stage: 'approved' }), question: null })?.kind).toBe(
      'working',
    );
  });

  it('maps asking with an open question to question and without one to working', () => {
    expect(commentOutcomeOf({ ...rowOf({ stage: 'asking' }), question: QUESTION })).toEqual({
      kind: 'question',
      text: QUESTION.text,
    });
    expect(commentOutcomeOf({ ...rowOf({ stage: 'asking' }), question: null })?.kind).toBe(
      'working',
    );
  });

  it('maps a reply draft with no fix to no-change carrying the reply', () => {
    expect(
      commentOutcomeOf({
        ...rowOf({ stage: 'proposed', disposition: 'reply', replyDraft: 'Kept as is.' }),
        question: null,
      }),
    ).toEqual({ kind: 'no-change', reply: 'Kept as is.' });
  });

  it('maps a proposed thread with nothing to say to no-change with an empty reply', () => {
    expect(commentOutcomeOf({ ...rowOf({ stage: 'proposed' }), question: null })).toEqual({
      kind: 'no-change',
      reply: '',
    });
  });

  it('maps an obsolete or fixed-elsewhere verdict to no-change with the verdict reply', () => {
    expect(
      commentOutcomeOf({
        ...rowOf({ stage: 'proposed', disposition: 'fix' }),
        question: null,
        verdict: OBSOLETE,
      }),
    ).toEqual({
      kind: 'no-change',
      reply: 'This code was removed in 6b0e9f1, so there is nothing left to change. Closing.',
    });
    expect(
      commentOutcomeOf({ ...rowOf({ stage: 'proposed' }), question: null, verdict: ELSEWHERE }),
    ).toEqual({ kind: 'no-change', reply: 'Handled in e31b9f4.' });
  });

  it('keeps a refix verdict as the fix it proposes', () => {
    expect(
      commentOutcomeOf({
        ...rowOf({ stage: 'proposed', disposition: 'fix' }),
        question: null,
        verdict: REFIX,
      }),
    ).toEqual({ kind: 'fix-proposed' });
  });

  it('maps a failed thread to failed with the runtime sentence', () => {
    expect(
      commentOutcomeOf({
        ...rowOf({ stage: 'failed' }),
        question: null,
        failure: 'The model provider stopped the run',
      }),
    ).toEqual({ kind: 'failed', sentence: 'The model provider stopped the run' });
    expect(commentOutcomeOf({ ...rowOf({ stage: 'failed' }), question: null })?.kind).toBe(
      'failed',
    );
  });

  it('returns nothing for a resolved or parked thread, integrated or not', () => {
    expect(
      commentOutcomeOf({
        ...rowOf({ stage: 'resolved', integratedSha: '9e4c1a7f00d1' }),
        question: null,
      }),
    ).toBeNull();
    expect(commentOutcomeOf({ ...rowOf({ stage: 'parked' }), question: null })).toBeNull();
  });
});

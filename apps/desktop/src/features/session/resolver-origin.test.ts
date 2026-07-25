import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { resolverOrigin } from './resolver-origin';

const base = {
  id: 'agent-1' as AgentId,
  sessionId: 'session-1' as SessionId,
  ordinal: 0,
  name: 'resolve: reviewer on a.ts:1',
  status: 'completed',
} satisfies Agent;

describe('resolverOrigin', () => {
  it('trusts the recorded source kind over any inference', () => {
    const origin = resolverOrigin({
      agent: { ...base, sourceKind: 'diff_comment' },
      hasDiffComment: false,
    });

    expect(origin.kind).toBe('diff_comment');
    expect(origin.isRecorded).toBe(true);
  });

  it('infers a review comment from the source thread when the kind is missing', () => {
    const origin = resolverOrigin({
      agent: { ...base, sourceThreadId: 'PRRT_1', sourceCommentUrl: 'https://x/1' },
      hasDiffComment: false,
    });

    expect(origin.kind).toBe('review_comment');
    expect(origin.isRecorded).toBe(false);
  });

  it('infers a conversation comment from a url without a thread', () => {
    const origin = resolverOrigin({
      agent: { ...base, sourceCommentUrl: 'https://x/1' },
      hasDiffComment: false,
    });

    expect(origin.kind).toBe('issue_comment');
  });

  it('infers an inline diff note from a consumed diff comment', () => {
    const origin = resolverOrigin({ agent: base, hasDiffComment: true });

    expect(origin.kind).toBe('diff_comment');
    expect(origin.isRecorded).toBe(false);
  });

  it('reports an unknown origin when nothing links the resolver', () => {
    const origin = resolverOrigin({ agent: base, hasDiffComment: false });

    expect(origin.kind).toBe('unknown');
    expect(origin.label).toBe('Unknown origin');
  });
});

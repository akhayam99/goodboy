import { describe, expect, it, vi } from 'vitest';
import type { AgentId, PrComment, PullRequestState, SessionId } from '@goodboy/types';
import type { CommentThread } from '../github/comment-threads';
import type { SpawnAgentFn } from '../review/startFixAttempt';
import { resolveAgentCount, startResolve } from './startResolve';

const SESSION_ID = 'session-1' as SessionId;
const PR = {
  number: 248,
  title: 'Retry budget for notify-relay',
  url: 'https://github.com/acme/notify-relay/pull/248',
  headBranch: 'feature/retry',
} as unknown as PullRequestState;

const threadOf = (threadId: string, path = 'src/retry.ts'): CommentThread => ({
  head: {
    id: `comment-${threadId}`,
    author: 'dhh',
    authorAvatarUrl: null,
    body: `Please look at ${threadId}.`,
    createdAt: '2026-01-05T09:00:00.000Z',
    url: `https://github.com/acme/notify-relay/pull/248#discussion_${threadId}`,
    source: 'review',
    resolved: false,
    path,
    line: 84,
    threadId,
  } as PrComment,
  replies: [],
});

const spawnSpy = () => {
  const spawnAgent = vi.fn<SpawnAgentFn>(async () => 'agent-1' as AgentId);
  const setAgentConfig = vi.fn(async () => undefined);
  return { spawnAgent, setAgentConfig };
};

describe('startResolve', () => {
  it('starts one resolver per selection with the thread ids and the marker contract', async () => {
    const { spawnAgent, setAgentConfig } = spawnSpy();
    await startResolve({
      sessionId: SESSION_ID,
      threads: [threadOf('PRRT_1'), threadOf('PRRT_2'), threadOf('PRRT_3', 'src/client.ts')],
      pr: PR,
      routing: { provider: 'codex', model: 'gpt-5.5', effort: 'high' },
      note: 'Keep the public API',
      spawnAgent,
      setAgentConfig,
    });

    expect(spawnAgent).toHaveBeenCalledTimes(1);
    const args = spawnAgent.mock.calls[0]?.[1];
    expect(args?.sourceThreadIds).toEqual(['PRRT_1', 'PRRT_2', 'PRRT_3']);
    expect(args?.kindOverride).toBe('resolver');
    expect(args?.initialPrompt).toContain('<<comment-resolved');
    expect(args?.initialPrompt).toContain('<<comment-reply');
    expect(args?.initialPrompt).toContain('Keep the public API');
    expect(args?.provider).toBe('codex');
    expect(args?.model).toBe('gpt-5.5');
    expect(args?.effort).toBe('high');
    expect(setAgentConfig).toHaveBeenCalledWith(SESSION_ID, 'agent-1', {
      providerOverride: 'codex',
      modelOverride: 'gpt-5.5',
      effort: 'high',
    });
  });

  it('counts one agent for a small selection', () => {
    expect(
      resolveAgentCount({
        threads: [threadOf('PRRT_1'), threadOf('PRRT_2')],
        pr: PR,
        routing: { provider: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
      }),
    ).toBe(1);
  });
});

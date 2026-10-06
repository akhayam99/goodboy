// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { AgentId, PrComment, PullRequestState, SessionId } from '@goodboy/types';
import type { CommentThread } from '../integrations/github/comment-threads';
import { startFixAttempt, type SetAgentConfigFn, type SpawnAgentFn } from './startFixAttempt';

const SESSION_ID = 'session-1' as SessionId;

const pr: PullRequestState = {
  number: 248,
  title: 'Retry failed requests',
  url: 'https://github.com/acme/web/pull/248',
  state: 'open',
  mergeable: null,
  checks: null,
  baseBranch: 'main',
  headBranch: 'feature/retry',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-01-01T00:00:00Z',
};

const threadOn = ({ id, path }: { readonly id: string; readonly path: string }): CommentThread => ({
  head: {
    id,
    author: 'harbor-reviewer',
    authorAvatarUrl: null,
    body: 'rename it',
    createdAt: '2026-01-01T00:00:00Z',
    url: `https://github.com/acme/web/pull/248#discussion_${id}`,
    source: 'review',
    threadId: id,
    path,
    line: 84,
  } satisfies PrComment,
  replies: [],
});

const harness = () => {
  let next = 0;
  const spawnAgent = vi.fn<SpawnAgentFn>(async () => `agent-${++next}` as AgentId);
  const setAgentConfig = vi.fn<SetAgentConfigFn>(async () => undefined);
  return { spawnAgent, setAgentConfig };
};

describe('startFixAttempt', () => {
  it('starts one agent for sixteen comments and hands it every thread id', async () => {
    const { spawnAgent, setAgentConfig } = harness();
    const threads = Array.from({ length: 16 }, (_, index) =>
      threadOn({ id: `t${index}`, path: index < 8 ? 'a.ts' : 'b.ts' }),
    );

    const started = await startFixAttempt({
      sessionId: SESSION_ID,
      threads,
      pr,
      spawnAgent,
      setAgentConfig,
    });

    expect(spawnAgent).toHaveBeenCalledTimes(1);
    expect(setAgentConfig).toHaveBeenCalledTimes(1);
    expect(started.agentId).toBe('agent-1');
    const args = spawnAgent.mock.calls[0]?.[1];
    expect(args?.sourceThreadIds).toEqual(threads.map((thread) => thread.head.threadId));
    expect(args?.focus).toBe('none');
    expect(args?.kindOverride).toBe('resolver');
    expect(args?.name).toBe('Resolve: 16 review comments');
  });

  it('writes one launch id on the agent and a new one on the next user action', async () => {
    const { spawnAgent, setAgentConfig } = harness();
    const threads = [threadOn({ id: 't1', path: 'a.ts' }), threadOn({ id: 't2', path: 'b.ts' })];

    const first = await startFixAttempt({
      sessionId: SESSION_ID,
      threads,
      pr,
      spawnAgent,
      setAgentConfig,
    });
    const second = await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [threads[0] ?? threadOn({ id: 't1', path: 'a.ts' })],
      pr,
      spawnAgent,
      setAgentConfig,
    });

    const launches = spawnAgent.mock.calls.map((call) => call[1].resolveLaunch);
    expect(launches[0]?.launchId).toBe(first.launchId);
    expect(launches[1]?.launchId).toBe(second.launchId);
    expect(second.launchId).not.toBe(first.launchId);
    expect(launches[0]).toEqual({ launchId: first.launchId });
  });

  it('quotes the previous reply and commit into the kickoff, scoped to the owning thread', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [threadOn({ id: 't1', path: 'a.ts' })],
      pr,
      instructions: 'prefer a guard clause',
      priorContext: [
        {
          threadId: 't1',
          reply: 'Added the early return.',
          commitShas: ['a1b2c3d'],
          intent: 'retry',
        },
        { threadId: 'other', reply: 'not mine', intent: 'retry' },
      ],
      spawnAgent,
      setAgentConfig,
    });

    const prompt = spawnAgent.mock.calls[0]?.[1].initialPrompt ?? '';
    expect(prompt).toContain('Added the early return.');
    expect(prompt).toContain('a1b2c3d');
    expect(prompt).toContain('prefer a guard clause');
    expect(prompt).not.toContain('not mine');
  });

  it('carries the model choice onto both the spawn and the agent config', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [threadOn({ id: 't1', path: 'a.ts' })],
      pr,
      choice: { provider: 'anthropic', model: 'opus-5', effort: 'high' },
      spawnAgent,
      setAgentConfig,
    });

    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      provider: 'anthropic',
      model: 'opus-5',
      effort: 'high',
      kindOverride: 'resolver',
    });
    expect(setAgentConfig.mock.calls[0]?.[2]).toEqual({
      providerOverride: 'anthropic',
      modelOverride: 'opus-5',
      effort: 'high',
    });
  });

  it('refuses to start an agent when there is no comment to fix', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    await expect(
      startFixAttempt({ sessionId: SESSION_ID, threads: [], pr, spawnAgent, setAgentConfig }),
    ).rejects.toThrow('A fix run needs at least one comment');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('rereads the saved launch choice of the batch', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [threadOn({ id: 't1', path: 'a.ts' })],
      pr,
      choice: { provider: 'anthropic', model: 'claude-opus-5' },
      instructions: 'Use the ledger helper',
      batch: {
        batchId: 'batch-1',
        launchChoice: {
          provider: 'codex',
          model: 'gpt-6-astra',
          effort: 'high',
          commitStyle: 'fixup',
          hint: 'Keep rounding half even',
        },
      },
      spawnAgent,
      setAgentConfig,
    });

    const args = spawnAgent.mock.calls[0]?.[1];
    expect(args?.provider).toBe('codex');
    expect(args?.model).toBe('gpt-6-astra');
    expect(args?.resolveBatch?.batchId).toBe('batch-1');
    expect(args?.initialPrompt).toContain('Keep rounding half even');
    expect(args?.initialPrompt).toContain('Use the ledger helper');
  });
});

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { AgentId, PrComment, PullRequestState, SessionId } from '@goodboy/types';
import type { CommentThread } from '../github/comment-threads';
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
  it('spawns one agent per chunk and hands each the thread ids it owns', async () => {
    const { spawnAgent, setAgentConfig } = harness();
    const threads = [
      ...Array.from({ length: 7 }, (_, index) => threadOn({ id: `a${index}`, path: 'a.ts' })),
      ...Array.from({ length: 6 }, (_, index) => threadOn({ id: `b${index}`, path: 'b.ts' })),
    ];

    const agentIds = await startFixAttempt({
      sessionId: SESSION_ID,
      threads,
      pr,
      mode: 'shared',
      spawnAgent,
      setAgentConfig,
    });

    expect(agentIds).toHaveLength(2);
    expect(spawnAgent).toHaveBeenCalledTimes(2);
    const owned = spawnAgent.mock.calls.map((call) => call[1].sourceThreadIds ?? []);
    expect(owned[0]).toHaveLength(7);
    expect(owned[1]).toHaveLength(6);
    expect(spawnAgent.mock.calls.every((call) => call[1].focus === 'none')).toBe(true);
    expect(setAgentConfig).toHaveBeenCalledTimes(2);
  });

  it('gives every conversation its own agent in separate mode', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [threadOn({ id: 't1', path: 'a.ts' }), threadOn({ id: 't2', path: 'a.ts' })],
      pr,
      mode: 'separate',
      spawnAgent,
      setAgentConfig,
    });

    expect(spawnAgent).toHaveBeenCalledTimes(2);
    expect(spawnAgent.mock.calls.map((call) => call[1].sourceThreadIds)).toEqual([['t1'], ['t2']]);
  });

  it('quotes the previous reply and commit into a retry kickoff, scoped to the owning thread', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [threadOn({ id: 't1', path: 'a.ts' })],
      pr,
      mode: 'retry',
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

  it('spawns a recheck as a read-only scout that answers with a verdict marker', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [threadOn({ id: 't1', path: 'a.ts' })],
      pr,
      mode: 'recheck',
      priorContext: [{ threadId: 't1', commitShas: ['a1b2c3d'], intent: 'recheck' }],
      spawnAgent,
      setAgentConfig,
    });

    const args = spawnAgent.mock.calls[0]?.[1];
    expect(args?.kindOverride).toBe('scout');
    expect(args?.sourceKind).toBe('comment_recheck');
    expect(args?.initialPrompt).toContain('no longer reachable');
    expect(args?.initialPrompt).toContain('read-only check');
    expect(args?.initialPrompt).toContain('<<comment-verdict');
    expect(args?.initialPrompt).not.toContain('git commit --amend');
    expect(args?.initialPrompt).not.toContain('<<comment-resolved');
  });

  it('starts one recheck per thread', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [threadOn({ id: 't1', path: 'a.ts' }), threadOn({ id: 't2', path: 'b.ts' })],
      pr,
      mode: 'recheck',
      spawnAgent,
      setAgentConfig,
    });

    expect(spawnAgent).toHaveBeenCalledTimes(2);
  });

  it('carries the model choice onto both the spawn and the agent config', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [threadOn({ id: 't1', path: 'a.ts' })],
      pr,
      choice: { provider: 'anthropic', model: 'opus-5', effort: 'high' },
      mode: 'shared',
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

  it('spawns nothing when there is no conversation to fix', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    const agentIds = await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [],
      pr,
      mode: 'shared',
      spawnAgent,
      setAgentConfig,
    });

    expect(agentIds).toEqual([]);
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('rereads the saved launch choice of the batch on a retry', async () => {
    const { spawnAgent, setAgentConfig } = harness();

    await startFixAttempt({
      sessionId: SESSION_ID,
      threads: [threadOn({ id: 't1', path: 'a.ts' })],
      pr,
      choice: { provider: 'anthropic', model: 'claude-opus-5' },
      instructions: 'Use the ledger helper',
      mode: 'retry',
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

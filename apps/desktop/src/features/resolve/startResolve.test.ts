import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, BranchCommit, PrComment, PullRequestState, SessionId } from '@goodboy/types';
import type { CommentThread } from '../github/comment-threads';
import type { SpawnAgentFn } from '../review/startFixAttempt';
import type { BlameLineParams } from '../worktree/worktree';
import { startResolve } from './startResolve';

const { listBranchCommits, worktreeBlameLine } = vi.hoisted(() => ({
  listBranchCommits: vi.fn<(path: string) => Promise<ReadonlyArray<BranchCommit>>>(),
  worktreeBlameLine: vi.fn<(params: BlameLineParams) => Promise<string | null>>(),
}));

vi.mock('../worktree/worktree', () => ({ listBranchCommits, worktreeBlameLine }));

beforeEach(() => {
  listBranchCommits.mockReset();
  worktreeBlameLine.mockReset();
});

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
    author: 'harbor-reviewer',
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

const batchOf = ({ hint = null }: { readonly hint?: string | null } = {}) => ({
  batchId: 'batch-1',
  launchChoice: {
    provider: 'codex',
    model: 'gpt-5.5',
    effort: 'high',
    commitStyle: null,
    hint,
  },
});

const spawnSpy = () => {
  const spawnAgent = vi.fn<SpawnAgentFn>(async () => 'agent-1' as AgentId);
  const setAgentConfig = vi.fn(async () => undefined);
  return { spawnAgent, setAgentConfig };
};

describe('startResolve', () => {
  it('starts one resolver per comment, all in the same batch, with the launch choice', async () => {
    const { spawnAgent, setAgentConfig } = spawnSpy();
    await startResolve({
      sessionId: SESSION_ID,
      threads: [threadOf('PRRT_1'), threadOf('PRRT_2'), threadOf('PRRT_3', 'src/client.ts')],
      pr: PR,
      batch: batchOf({ hint: 'Keep the public API' }),
      spawnAgent,
      setAgentConfig,
    });

    expect(spawnAgent).toHaveBeenCalledTimes(3);
    expect(spawnAgent.mock.calls.map(([, call]) => call.sourceThreadIds)).toEqual([
      ['PRRT_1'],
      ['PRRT_2'],
      ['PRRT_3'],
    ]);
    expect(spawnAgent.mock.calls.map(([, call]) => call.resolveBatch?.batchId)).toEqual([
      'batch-1',
      'batch-1',
      'batch-1',
    ]);
    const args = spawnAgent.mock.calls[0]?.[1];
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

  it('asks for a fixup of the commit that introduced the commented line', async () => {
    const { spawnAgent, setAgentConfig } = spawnSpy();
    listBranchCommits.mockResolvedValue([
      { sha: '3a1f9c2full', subject: 'Add retry policy' } as BranchCommit,
    ]);
    worktreeBlameLine.mockImplementation(async ({ path }) =>
      path === 'src/retry.ts' ? '3a1f9c2full' : 'not-on-branch',
    );

    await startResolve({
      sessionId: SESSION_ID,
      threads: [threadOf('PRRT_1'), threadOf('PRRT_2', 'src/client.ts')],
      pr: PR,
      batch: batchOf(),
      style: {
        commitStyle: 'fixup',
        voice: 'friendly',
        styleNote: null,
        worktreePath: '/repos/notify-relay',
      },
      spawnAgent,
      setAgentConfig,
    });

    const prompt = spawnAgent.mock.calls[0]?.[1].initialPrompt ?? '';
    expect(spawnAgent.mock.calls[0]?.[1].resolveBatch?.launchChoice.commitStyle).toBe('fixup');
    expect(worktreeBlameLine).toHaveBeenCalledWith({
      worktreePath: '/repos/notify-relay',
      path: 'src/retry.ts',
      line: 84,
    });
    expect(prompt).toContain(
      '- PRRT_1: `git commit --fixup=3a1f9c2full`, so the subject reads `fixup! Add retry policy`',
    );
    expect(spawnAgent.mock.calls[1]?.[1].initialPrompt).not.toContain('--fixup=3a1f9c2full');
    expect(prompt).toContain('Voice: friendly.');
  });

  it('keeps the fixup style and the prior work when a thread is retried', async () => {
    const { spawnAgent, setAgentConfig } = spawnSpy();
    listBranchCommits.mockResolvedValue([
      { sha: '3a1f9c2full', subject: 'Add retry policy' } as BranchCommit,
    ]);
    worktreeBlameLine.mockResolvedValue('3a1f9c2full');

    await startResolve({
      sessionId: SESSION_ID,
      threads: [threadOf('PRRT_1')],
      pr: PR,
      routing: { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' },
      note: 'The race is in the insert',
      mode: 'retry',
      priorContext: [
        { threadId: 'PRRT_1', reply: 'Tried a lock', commitShas: ['aa11bb22'], intent: 'retry' },
      ],
      style: {
        commitStyle: 'fixup',
        voice: 'terse',
        styleNote: null,
        worktreePath: '/repos/notify-relay',
      },
      spawnAgent,
      setAgentConfig,
    });

    const args = spawnAgent.mock.calls[0]?.[1];
    expect(args?.model).toBe('claude-opus-5');
    expect(args?.effort).toBe('high');
    expect(args?.initialPrompt).toContain('git commit --fixup=3a1f9c2full');
    expect(args?.initialPrompt).toContain('another pass on this thread');
    expect(args?.initialPrompt).toContain('Tried a lock');
    expect(args?.initialPrompt).toContain('The race is in the insert');
  });

  it('never reads git for the default new commit style', async () => {
    const { spawnAgent, setAgentConfig } = spawnSpy();

    await startResolve({
      sessionId: SESSION_ID,
      threads: [threadOf('PRRT_1')],
      pr: PR,
      batch: batchOf(),
      style: {
        commitStyle: 'new',
        voice: 'terse',
        styleNote: null,
        worktreePath: '/repos/notify-relay',
      },
      spawnAgent,
      setAgentConfig,
    });

    expect(worktreeBlameLine).not.toHaveBeenCalled();
    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).not.toContain('How to commit');
  });
});

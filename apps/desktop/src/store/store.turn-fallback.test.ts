import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import {
  buildStoryAgent,
  buildStorySession,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  resetStorySpies,
  storySpies,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const SESSION_ID = 'session-fallback-1' as SessionId;
const AGENT_A = 'agent-fallback-a' as AgentId;
const WORKSPACE_ID = 'workspace-fallback' as WorkspaceId;
const NOW = '2026-07-30T00:00:00.000Z' as IsoDateTime;

type StoreModule = typeof import('./store');
let useAppStore: StoreModule['useAppStore'];

beforeAll(async () => {
  ({ useAppStore } = await import('./store'));
}, 60_000);

describe('sendTurn, provider failure fallback', () => {
  beforeEach(async () => {
    resetStorySpies();
    storySpies.runTurn.mockImplementation(() => emptyTurnStream());
    storySpies.tauriInvoke.mockResolvedValue({
      stdout: JSON.stringify({ result: JSON.stringify({ upserts: [] }) }),
      stderr: '',
      exitCode: 0,
    } as never);
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-sonnet-4-5',
      reason: 'preference',
      fallbackUsed: false,
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const setup = () => {
    useAppStore.setState({
      sessions: [
        buildStorySession({
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          goal: 'test turn fallback',
          state: { kind: 'idle', lastActivityAt: NOW },
        }),
      ],
      projects: [],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: {
        [SESSION_ID]: [buildStoryAgent({ id: AGENT_A, sessionId: SESSION_ID, name: 'agent 0' })],
      },
      selectedAgentId: { [SESSION_ID]: AGENT_A },
      transcripts: { [AGENT_A]: [] },
      agentEffortOverride: {},
      agentProviderOverride: {},
      agentModelOverride: {},
      workspaces: [
        buildStoryWorkspace({ id: WORKSPACE_ID, name: 'ws', slug: 'ws', sessionsRoot: '/tmp' }),
      ],
      ...connectedAnthropicState(),
    });
  };

  it('retries a usage-limit failure once on a cheaper model of the same provider', async () => {
    setup();
    storySpies.runTurn.mockImplementationOnce(async function* () {
      throw new Error('rate limit exceeded for this account');
    });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' });

    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    expect(storySpies.runTurn.mock.calls[0]?.[0]?.model).toBe('claude-sonnet-4-5');
    expect(storySpies.runTurn.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ provider: 'anthropic', model: 'claude-haiku-4-5' }),
    );
    const transcript = useAppStore.getState().transcripts[AGENT_A] ?? [];
    const notice = transcript.find(
      (event) => event.kind === 'error' && event.message.includes('retrying on'),
    );
    expect(notice).toBeDefined();
    expect(transcript.filter((event) => event.kind === 'user_text')).toHaveLength(1);
    expect(useAppStore.getState().agentTurnState[AGENT_A]?.kind).not.toBe('error');
  });

  it('reuses the attachments of the first attempt instead of writing them again', async () => {
    setup();
    storySpies.runTurn.mockImplementationOnce(async function* () {
      throw new Error('rate limit exceeded for this account');
    });

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: AGENT_A,
      content: 'read the spec',
      attachments: [
        {
          id: 'attachment-1',
          fileName: 'spec.pdf',
          mimeType: 'application/pdf',
          dataBase64: 'ZmFrZQ==',
        } as never,
      ],
    });

    expect(storySpies.writeAttachment).toHaveBeenCalledOnce();
    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    expect(storySpies.runTurn.mock.calls[1]?.[0]?.prompt).toContain(
      '.goodboy/attachments/spec.pdf',
    );
    const transcript = useAppStore.getState().transcripts[AGENT_A] ?? [];
    expect(transcript.filter((event) => event.kind === 'user_text')).toHaveLength(1);
  });

  it('leaves an unclassified failure in the error state without retrying', async () => {
    setup();
    storySpies.runTurn.mockImplementation(async function* () {
      throw new Error('connection reset by peer');
    });

    await expect(
      useAppStore.getState().sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' }),
    ).rejects.toThrow('connection reset by peer');

    expect(storySpies.runTurn).toHaveBeenCalledOnce();
    expect(useAppStore.getState().agentTurnState[AGENT_A]?.kind).toBe('error');
  });

  const LOCK_OUTPUT =
    "fatal: Unable to create '/tmp/wt/.git/index.lock': File exists.\n\n" +
    'Another git process seems to be running in this repository.';

  const streamToolCallEnd = ({ output }: { readonly output: unknown }) =>
    async function* () {
      yield {
        kind: 'tool_call_end',
        runId: 'run-lock-1',
        toolUseId: 'tu-1',
        output,
        isError: true,
        at: NOW,
      };
    };

  it('surfaces a git index.lock tool failure as a retryable transcript error', async () => {
    setup();
    storySpies.runTurn.mockImplementation(streamToolCallEnd({ output: LOCK_OUTPUT }));

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'commit it' });

    const transcript = useAppStore.getState().transcripts[AGENT_A] ?? [];
    const failure = transcript.find(
      (event) => event.kind === 'error' && event.message.includes('.git/index.lock'),
    );
    expect(failure).toBeDefined();
    expect(failure).toMatchObject({ retryable: true });
  });

  it('leaves an ordinary tool failure out of the transcript', async () => {
    setup();
    storySpies.runTurn.mockImplementation(streamToolCallEnd({ output: 'command not found: foo' }));

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'run it' });

    const transcript = useAppStore.getState().transcripts[AGENT_A] ?? [];
    expect(
      transcript.filter(
        (event) => event.kind === 'error' && event.message.includes('.git/index.lock'),
      ),
    ).toHaveLength(0);
  });
});

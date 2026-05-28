// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IsoDateTime, ProviderRunId, Session } from '@goodboy/types';

// Module mocks, hoisted before imports that transitively pull the mocked modules.
// vi.hoisted keeps shared refs alive across the hoisting reorder.
const { sendTurnMock, cancelCurrentTurnMock, mockStore } = await vi.hoisted(async () => {
  const { create } = await import('zustand');
  const send = vi.fn(async () => undefined);
  const cancel = vi.fn();
  interface S {
    sendTurn: typeof send;
    cancelCurrentTurn: typeof cancel;
    setAgentVerbosity: (sessionId: string, agentId: string, level: string) => Promise<void>;
    setSessionConfig: (sessionId: string, fields: unknown) => Promise<void>;
    setAgentConfig: (sessionId: string, agentId: string, fields: unknown) => Promise<void>;
    workspaceOverrides: Record<string, never>;
    providers: ReadonlyArray<{ id: string; connection: string }>;
    skills: Record<string, never>;
    workspaceScripts: Record<string, never>;
    sessionWorktrees: Record<string, ReadonlyArray<string>>;
    providerSpendBreakdown: ReadonlyArray<never>;
    selectedAgentId: Record<string, string>;
    agentTurnState: Record<string, never>;
    agentModelOverride: Record<string, never>;
    agentKindOverride: Record<string, never>;
    agentRunHistory: Record<string, never>;
    agentDraft: Record<string, string>;
    sessionNudges: Record<string, null>;
    sessionPhaseRuns: Record<string, ReadonlyArray<never>>;
    phaseTemplates: Record<string, never>;
    setAgentDraft: (agentId: string, value: string) => void;
    clearAgentDraft: (agentId: string) => void;
    dismissSessionNudge: () => Promise<void>;
    acceptSessionNudgeHandoff: () => Promise<void>;
    spawnAgent: () => Promise<void>;
    runScript: () => Promise<{ stdout: string; stderr: string; exitCode: number }>;
    loadScripts: () => Promise<void>;
    selectAgent: () => Promise<void>;
    attachWorkflowToSession: () => Promise<void>;
    loadPhaseTemplates: () => Promise<void>;
    loadPhaseRunsForSession: () => Promise<void>;
  }
  const store = create<S>((set) => ({
    sendTurn: send,
    cancelCurrentTurn: cancel,
    setAgentVerbosity: async () => undefined,
    setSessionConfig: async () => undefined,
    setAgentConfig: async () => undefined,
    workspaceOverrides: {},
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'cursor', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ],
    skills: {},
    workspaceScripts: {},
    sessionWorktrees: {},
    providerSpendBreakdown: [],
    selectedAgentId: { 'session-1': 'agent-1' },
    agentTurnState: {},
    agentModelOverride: {},
    agentKindOverride: {},
    agentRunHistory: {},
    agentDraft: {},
    sessionNudges: {},
    sessionPhaseRuns: {},
    phaseTemplates: {},
    setAgentDraft: (agentId, value) =>
      set((s) => ({ agentDraft: { ...s.agentDraft, [agentId]: value } })),
    clearAgentDraft: (agentId) =>
      set((s) => {
        if (!(agentId in s.agentDraft)) return s;
        const next = { ...s.agentDraft };
        delete next[agentId];
        return { agentDraft: next };
      }),
    dismissSessionNudge: async () => undefined,
    acceptSessionNudgeHandoff: async () => undefined,
    spawnAgent: async () => undefined,
    runScript: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    loadScripts: async () => undefined,
    selectAgent: async () => undefined,
    attachWorkflowToSession: async () => undefined,
    loadPhaseTemplates: async () => undefined,
    loadPhaseRunsForSession: async () => undefined,
  }));
  return { sendTurnMock: send, cancelCurrentTurnMock: cancel, mockStore: store };
});

function resetMockStore() {
  mockStore.setState({ agentDraft: {} });
}

vi.mock('../../../../store', () => ({
  useAppStore: mockStore,
  EMPTY_ARRAY: [] as never[],
}));

vi.mock('../../../../permissions', () => ({
  useEffectivePermissionRules: () => [],
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@goodboy/core', () => ({
  buildClaudeFlags: () => ({ allowedTools: [], disallowedTools: [] }),
  getDefaultTurnModel: () => 'claude-3-5-sonnet-latest',
  PROVIDER_CAPABILITIES: {
    anthropic: {
      models: [{ id: 'claude-3-5-sonnet-latest', tier: 'turn', contextWindow: 200_000 }],
    },
    cursor: { models: [{ id: 'claude-sonnet-4-5', tier: 'turn', contextWindow: 200_000 }] },
    codex: { models: [{ id: 'codex-latest', tier: 'turn', contextWindow: 128_000 }] },
  },
  resolveProvider: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-5-sonnet-latest',
    reason: 'preference',
  })),
  assessTurnWeight: () => 'small',
}));

// Import component AFTER mocks are in place.
import { ChatInput } from './index';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1' as Session['id'],
    workspaceId: 'ws-1' as Session['workspaceId'],
    goal: 'test goal',
    state: { kind: 'idle', lastActivityAt: '2026-01-01T00:00:00.000Z' as IsoDateTime },
    contextSlots: [],
    providerPreference: {
      defaultProvider: 'anthropic' as Session['providerPreference']['defaultProvider'],
      allowTurnOverride: false,
    },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    workflowIds: [],
    currentStepByWorkflow: {},
    userStatus: 'wip',
    createdAt: '2026-01-01T00:00:00.000Z' as Session['createdAt'],
    updatedAt: '2026-01-01T00:00:00.000Z' as Session['updatedAt'],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetMockStore();
});

describe('ChatInput, input wiring', () => {
  it('typed characters appear in the textarea', async () => {
    const user = userEvent.setup();
    render(<ChatInput session={makeSession()} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello');

    expect((textarea as HTMLTextAreaElement).value).toBe('hello');
  });

  it('textarea is enabled when session is idle and provider is connected', () => {
    render(<ChatInput session={makeSession()} />);
    const textarea = screen.getByRole('textbox');
    expect((textarea as HTMLTextAreaElement).disabled).toBe(false);
  });

  it('textarea stays enabled when session is running so user can queue next message', () => {
    render(
      <ChatInput
        session={makeSession({
          state: {
            kind: 'running',
            runId: 'run-1' as ProviderRunId,
            startedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
          },
        })}
      />,
    );
    const textarea = screen.getByRole('textbox');
    expect((textarea as HTMLTextAreaElement).disabled).toBe(false);
  });

  it('Enter sends the turn and clears the input', async () => {
    const user = userEvent.setup();
    render(<ChatInput session={makeSession()} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello');
    await user.keyboard('{Enter}');

    expect(sendTurnMock).toHaveBeenCalledOnce();
    expect(sendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', content: 'hello' }),
    );
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('Shift+Enter inserts a newline instead of sending', async () => {
    const user = userEvent.setup();
    render(<ChatInput session={makeSession()} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(sendTurnMock).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe('hello\n');
  });

  it('send button invokes sendTurn', async () => {
    const user = userEvent.setup();
    render(<ChatInput session={makeSession()} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hi there');

    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    expect(sendTurnMock).toHaveBeenCalledOnce();
    expect(sendTurnMock).toHaveBeenCalledWith(expect.objectContaining({ content: 'hi there' }));
  });

  it('provider override persists across sends (regression for bug D)', async () => {
    // Session arrives with provider already overridden (persisted on DB).
    const setSessionConfig = vi.fn(async () => undefined);
    mockStore.setState({ setSessionConfig });

    const user = userEvent.setup();
    render(
      <ChatInput
        session={makeSession({
          providerPreference: {
            defaultProvider: 'anthropic' as Session['providerPreference']['defaultProvider'],
            allowTurnOverride: true,
          },
          providerOverride: 'cursor',
        })}
      />,
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello cursor');
    await user.keyboard('{Enter}');

    expect(sendTurnMock).toHaveBeenCalledOnce();
    expect(sendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        override: expect.objectContaining({ providerId: 'cursor' }),
      }),
    );
  });
});

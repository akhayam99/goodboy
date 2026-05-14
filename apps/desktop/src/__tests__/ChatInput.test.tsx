// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IsoDateTime, ProviderRunId, Task } from '@kay-am/types';

// Module mocks — hoisted before imports that transitively pull the mocked modules.
const sendTurnMock = vi.fn(async () => undefined);
const cancelCurrentTurnMock = vi.fn();

vi.mock('../store', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({
      sendTurn: sendTurnMock,
      cancelCurrentTurn: cancelCurrentTurnMock,
      providers: [
        { id: 'anthropic', connection: 'connected' },
        { id: 'cursor', connection: 'connected' },
        { id: 'codex', connection: 'connected' },
      ],
      skills: {},
      providerSpendBreakdown: [],
      selectedAgentId: {},
      agentTurnState: {},
      agentModelOverride: {},
    }),
  EMPTY_ARRAY: [] as never[],
}));

vi.mock('../permissions', () => ({
  useEffectivePermissionRules: () => [],
}));

vi.mock('../components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@kay-am/core', () => ({
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
}));

// Import component AFTER mocks are in place.
import { ChatInput } from '../components/chat/ChatInput';

function makeSession(overrides: Partial<Task> = {}): Task {
  return {
    id: 'session-1' as Task['id'],
    workspaceId: 'ws-1' as Task['workspaceId'],
    goal: 'test goal',
    state: { kind: 'idle', lastActivityAt: '2026-01-01T00:00:00.000Z' as IsoDateTime },
    contextSlots: [],
    providerPreference: {
      defaultProvider: 'anthropic' as Task['providerPreference']['defaultProvider'],
      allowTurnOverride: false,
    },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    createdAt: '2026-01-01T00:00:00.000Z' as Task['createdAt'],
    updatedAt: '2026-01-01T00:00:00.000Z' as Task['updatedAt'],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChatInput — input wiring', () => {
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
      expect.objectContaining({ taskId: 'session-1', content: 'hello' }),
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
    // Pre-populate localStorage: user previously picked cursor for this session.
    localStorage.setItem('kay-am:provider:session-1', 'cursor');

    const user = userEvent.setup();
    render(
      <ChatInput
        session={makeSession({
          providerPreference: {
            defaultProvider: 'anthropic' as Task['providerPreference']['defaultProvider'],
            allowTurnOverride: true,
          },
        })}
      />,
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello cursor');
    await user.keyboard('{Enter}');

    expect(sendTurnMock).toHaveBeenCalledOnce();
    // After send, the selected provider must still be cursor (not reset to anthropic).
    expect(localStorage.getItem('kay-am:provider:session-1')).toBe('cursor');
  });
});

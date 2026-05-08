// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IsoDateTime, ProviderRunId, Session } from '@kay-am/types';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports that transitively pull the mocked modules
// ---------------------------------------------------------------------------

const sendTurnMock = vi.fn(async () => undefined);
const cancelCurrentTurnMock = vi.fn();

vi.mock('../store', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({
      sendTurn: sendTurnMock,
      cancelCurrentTurn: cancelCurrentTurnMock,
      providers: [{ id: 'anthropic', connection: 'connected' }],
      skills: {},
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
  resolveProvider: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-5-sonnet-latest',
    reason: 'preference',
  })),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks are in place
// ---------------------------------------------------------------------------

import { ChatInput } from '../components/chat/ChatInput';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
    createdAt: '2026-01-01T00:00:00.000Z' as Session['createdAt'],
    updatedAt: '2026-01-01T00:00:00.000Z' as Session['updatedAt'],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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

  it('textarea is disabled when session is running', () => {
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
    expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
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
});

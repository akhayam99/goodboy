// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IsoDateTime, ProviderRunId, Session } from '@goodboy/types';

const {
  sendTurnMock,
  cancelCurrentTurnMock,
  mockStore,
  writeAttachmentMock,
  readAttachmentMock,
  deleteAttachmentMock,
  readDroppedAttachmentMock,
} = await vi.hoisted(async () => {
  const { create } = await import('zustand');
  const send = vi.fn(async () => undefined);
  const cancel = vi.fn();
  const writeAttachment = vi.fn(async () => 'attachments/att-pic.png');
  const readAttachment = vi.fn(async () => 'data:image/png;base64,QUJD');
  const deleteAttachment = vi.fn(async () => undefined);
  const readDroppedAttachment = vi.fn(async () => ({
    fileName: 'pic.png',
    mimeType: 'image/png',
    dataBase64: 'QUJD',
  }));
  type S = {
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
    agentModelOverride: Record<string, string>;
    agentProviderOverride: Record<string, never>;
    agentKindOverride: Record<string, never>;
    agentRunHistory: Record<string, never>;
    agentDraft: Record<string, string>;
    agentAttachments: Record<string, ReadonlyArray<never>>;
    agentQueue: Record<string, ReadonlyArray<{ id: string }>>;
    sessionTelemetry: Record<string, ReadonlyArray<{ kind: string; estimatedCostUsd: number }>>;
    sessionNudges: Record<string, null>;
    sessionPhaseRuns: Record<string, ReadonlyArray<never>>;
    phaseTemplates: Record<string, never>;
    setAgentDraft: (agentId: string, value: string) => void;
    clearAgentDraft: (agentId: string) => void;
    setAgentAttachments: (agentId: string, attachments: ReadonlyArray<never>) => void;
    clearAgentAttachments: (agentId: string) => void;
    setAgentQueue: (agentId: string, queue: ReadonlyArray<{ id: string }>) => void;
    clearAgentQueue: (agentId: string) => void;
    dismissSessionNudge: () => Promise<void>;
    acceptSessionNudgeHandoff: () => Promise<void>;
    spawnAgent: () => Promise<void>;
    runScript: () => Promise<{ stdout: string; stderr: string; exitCode: number }>;
    loadScripts: () => Promise<void>;
    selectAgent: () => Promise<void>;
    attachWorkflowToSession: () => Promise<void>;
    loadPhaseTemplates: () => Promise<void>;
    loadPhaseRunsForSession: () => Promise<void>;
  };
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
    agentProviderOverride: {},
    agentKindOverride: {},
    agentRunHistory: {},
    agentDraft: {},
    agentAttachments: {},
    agentQueue: {},
    sessionTelemetry: {},
    sessionNudges: {},
    sessionPhaseRuns: {},
    phaseTemplates: {},
    setAgentDraft: (agentId, value) =>
      set((s) => ({ agentDraft: { ...s.agentDraft, [agentId]: value } })),
    clearAgentDraft: (agentId) =>
      set((s) => {
        if (!(agentId in s.agentDraft)) {
          return s;
        }
        const next = { ...s.agentDraft };
        delete next[agentId];
        return { agentDraft: next };
      }),
    setAgentAttachments: (agentId, attachments) =>
      set((s) => ({ agentAttachments: { ...s.agentAttachments, [agentId]: attachments } })),
    clearAgentAttachments: (agentId) =>
      set((s) => {
        if (!(agentId in s.agentAttachments)) {
          return s;
        }
        const next = { ...s.agentAttachments };
        delete next[agentId];
        return { agentAttachments: next };
      }),
    setAgentQueue: (agentId, queue) =>
      set((s) => ({ agentQueue: { ...s.agentQueue, [agentId]: queue } })),
    clearAgentQueue: (agentId) =>
      set((s) => {
        if (!(agentId in s.agentQueue)) {
          return s;
        }
        const next = { ...s.agentQueue };
        delete next[agentId];
        return { agentQueue: next };
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
  return {
    sendTurnMock: send,
    cancelCurrentTurnMock: cancel,
    mockStore: store,
    writeAttachmentMock: writeAttachment,
    readAttachmentMock: readAttachment,
    deleteAttachmentMock: deleteAttachment,
    readDroppedAttachmentMock: readDroppedAttachment,
  };
});

function resetMockStore() {
  mockStore.setState({
    agentDraft: {},
    agentAttachments: {},
    agentQueue: {},
    sessionWorktrees: {},
    sessionTelemetry: {},
  });
}

vi.mock('../../../../store', () => ({
  useAppStore: mockStore,
  EMPTY_ARRAY: [] as never[],
  useSessionCost: (sessionId: string) => {
    const records = mockStore.getState().sessionTelemetry[sessionId] ?? [];
    return records.reduce(
      (sum, record) => (record.kind === 'summarizer' ? sum : sum + record.estimatedCostUsd),
      0,
    );
  },
}));

vi.mock('../../../../permissions', () => ({
  useEffectivePermissionRules: () => [],
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../turn', () => ({
  writeAttachment: writeAttachmentMock,
  readAttachment: readAttachmentMock,
  deleteAttachment: deleteAttachmentMock,
  readDroppedAttachment: readDroppedAttachmentMock,
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...actual,
    buildClaudeFlags: () => ({ allowedTools: [], disallowedTools: [] }),
    resolveProvider: vi.fn(async () => ({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-sonnet-4-6',
      reason: 'preference',
    })),
    assessTurnWeight: () => 'small',
  };
});

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
    workflowRuns: [],
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

  it('focuses the textarea when requested by a transcript CTA', () => {
    render(<ChatInput session={makeSession()} />);
    const textarea = screen.getByRole('textbox');
    window.dispatchEvent(new CustomEvent('goodboy:focus-composer'));
    expect(document.activeElement).toBe(textarea);
  });

  it('shows the session cost badge in the footer once spend accrues', () => {
    mockStore.setState({
      sessionTelemetry: {
        'session-1': [
          { kind: 'turn', estimatedCostUsd: 1.5 },
          { kind: 'summarizer', estimatedCostUsd: 9 },
        ],
      },
    });
    render(<ChatInput session={makeSession()} />);
    expect(screen.getByTitle(/session spend: \$1\.50/i)).toBeDefined();
  });

  it('hides the session cost badge when there is no spend yet', () => {
    render(<ChatInput session={makeSession()} />);
    expect(screen.queryByTitle(/session spend/i)).toBeNull();
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
          providerPreference: {
            defaultProvider: 'anthropic',
            allowTurnOverride: true,
          },
        })}
      />,
    );
    const textarea = screen.getByRole('textbox');
    expect((textarea as HTMLTextAreaElement).disabled).toBe(false);
    expect(
      (screen.getByRole('button', { name: /^Model routing:/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
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

  it('shows a composer alert with retry when sendTurn fails before transcript append', async () => {
    sendTurnMock.mockRejectedValueOnce(new Error('session not found: session-1'));
    const user = userEvent.setup();
    render(<ChatInput session={makeSession()} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('session not found: session-1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'retry' })).toBeTruthy();
  });

  it('suppresses the composer alert for transcript-owned stream failures', async () => {
    sendTurnMock.mockRejectedValueOnce(
      Object.assign(new Error('connection reset by peer'), {
        code: 'TRANSCRIPT_OWNED_TURN_ERROR',
      }),
    );
    const user = userEvent.setup();
    render(<ChatInput session={makeSession()} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(sendTurnMock).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not leak a stale session model into an agent without a model pin', async () => {
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
          modelOverride: 'claude-sonnet-4-6',
        })}
      />,
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello cursor');
    await user.keyboard('{Enter}');

    expect(sendTurnMock).toHaveBeenCalledOnce();
    expect(sendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        override: expect.objectContaining({
          providerId: 'cursor',
          model: 'composer-2.5',
          selection: expect.objectContaining({ key: 'composer-2.5' }),
        }),
      }),
    );
  });

  it('clears a codex model when switching the composer back to claude', async () => {
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
          providerOverride: 'codex',
          modelOverride: 'codex-latest',
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Model routing:/ }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Model routing' })).getByRole('button', {
        name: 'Claude',
      }),
    );

    expect(setSessionConfig).toHaveBeenCalledWith('session-1', {
      providerOverride: 'anthropic',
      modelOverride: null,
    });

    await user.click(screen.getByRole('button', { name: /^Model routing:/ }));
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'back to claude');
    await user.keyboard('{Enter}');

    expect(sendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        override: expect.objectContaining({
          providerId: 'anthropic',
          model: 'opus-5',
          selection: expect.objectContaining({ key: 'opus-5' }),
        }),
      }),
    );
  });

  it('provider override persists across multiple sends (regression for bug D)', async () => {
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
    await user.type(textarea, 'first cursor turn');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(sendTurnMock).toHaveBeenCalledOnce();
    });

    await user.type(textarea, 'second cursor turn');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(sendTurnMock).toHaveBeenCalledTimes(2);
    });

    expect(sendTurnMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: 'first cursor turn',
        override: expect.objectContaining({
          providerId: 'cursor',
          model: 'composer-2.5',
          selection: expect.objectContaining({ key: 'composer-2.5' }),
        }),
      }),
    );
    expect(sendTurnMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        content: 'second cursor turn',
        override: expect.objectContaining({
          providerId: 'cursor',
          model: 'composer-2.5',
          selection: expect.objectContaining({ key: 'composer-2.5' }),
        }),
      }),
    );
  });

  it('sends cursor when the picker shows cursor even with an anthropic agent model pin', async () => {
    mockStore.setState({
      agentModelOverride: { 'agent-1': 'claude-haiku-4-5' },
    });

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
    await user.type(textarea, 'use cursor');
    await user.keyboard('{Enter}');

    expect(sendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        override: expect.objectContaining({
          providerId: 'cursor',
          model: 'composer-2.5',
          selection: expect.objectContaining({ key: 'composer-2.5' }),
        }),
      }),
    );
  });
});

describe('ChatInput, attachment persistence', () => {
  const pngFile = () => new File(['abc'], 'pic.png', { type: 'image/png' });

  function fileInput(container: HTMLElement): HTMLInputElement {
    const input = container.querySelector('input[type="file"]');
    if (!input) {
      throw new Error('file input not found');
    }
    return input as HTMLInputElement;
  }

  it('persists an added attachment to the store and restores it on remount', async () => {
    mockStore.setState({ sessionWorktrees: { 'session-1': ['/wt'] } });
    const user = userEvent.setup();
    const { container, unmount } = render(<ChatInput session={makeSession()} />);

    await user.upload(fileInput(container), pngFile());

    expect(await screen.findByAltText('pic.png')).toBeTruthy();
    await waitFor(() => {
      expect(mockStore.getState().agentAttachments['agent-1']?.length).toBe(1);
    });
    expect(writeAttachmentMock).toHaveBeenCalled();
    expect(mockStore.getState().agentAttachments['agent-1']?.[0]).toMatchObject({
      fileName: 'pic.png',
      mimeType: 'image/png',
      relPath: 'attachments/att-pic.png',
    });

    unmount();
    readAttachmentMock.mockClear();
    render(<ChatInput session={makeSession()} />);

    expect(await screen.findByAltText('pic.png')).toBeTruthy();
    expect(readAttachmentMock).toHaveBeenCalledWith('/wt', 'attachments/att-pic.png');
  });

  it('clears stored attachments and deletes the disk file on send', async () => {
    mockStore.setState({ sessionWorktrees: { 'session-1': ['/wt'] } });
    const user = userEvent.setup();
    const { container } = render(<ChatInput session={makeSession()} />);

    await user.upload(fileInput(container), pngFile());
    await screen.findByAltText('pic.png');
    await waitFor(() => {
      expect(mockStore.getState().agentAttachments['agent-1']?.length).toBe(1);
    });

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'with attachment');
    await user.keyboard('{Enter}');

    expect(sendTurnMock).toHaveBeenCalledOnce();
    expect(sendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([expect.objectContaining({ fileName: 'pic.png' })]),
      }),
    );
    await waitFor(() => {
      expect(deleteAttachmentMock).toHaveBeenCalledWith('/wt', 'attachments/att-pic.png');
    });
    await waitFor(() => {
      expect(mockStore.getState().agentAttachments['agent-1']).toBeUndefined();
    });
  });
});

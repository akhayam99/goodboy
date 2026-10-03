// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  ChatId,
  ChatMessage,
  ChatMessageId,
  ChatSummary,
  IsoDateTime,
  WorkspaceId,
} from '@goodboy/types';

const { store, summarize } = vi.hoisted(() => ({
  summarize: vi.fn(async (_params: Record<string, unknown>) =>
    JSON.stringify({
      title: 'Ask for consent again when the policy changes',
      goal: 'Ask for consent again when the policy version changes.',
      know: ['Consent is step 4, in steps.ts:88.'],
      files: ['payments-api/src/questionnaire/steps.ts:88'],
      projects: ['payments-api'],
    }),
  ),
  store: {
    workspaces: [{ id: 'ws-harborline', name: 'Harborline' }],
    projects: [
      { id: 'project-payments', workspaceId: 'ws-harborline', name: 'payments-api' },
      { id: 'project-ledger', workspaceId: 'ws-harborline', name: 'ledger-core' },
    ],
    sessions: [] as ReadonlyArray<unknown>,
    stages: {} as Record<string, string>,
    mounts: {} as Record<string, ReadonlyArray<{ readonly projectId: string }>>,
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'opencode', connection: 'connected' },
    ],
    cliRequirements: [] as ReadonlyArray<unknown>,
    settings: {} as Record<string, string>,
    chatLinks: {} as Record<string, ReadonlyArray<unknown>>,
    chatMessages: {} as Record<string, ReadonlyArray<unknown>>,
    chatStreams: {} as Record<string, unknown>,
    loadChatMessages: vi.fn(async () => undefined),
    createChat: vi.fn(async () => 'chat-new'),
    sendChatMessage: vi.fn(async () => undefined),
    stopChatReply: vi.fn(async () => undefined),
    setChatModel: vi.fn(async () => undefined),
    createSession: vi.fn(async (_input: Record<string, unknown>) => ({
      session: { id: 'session-new' },
    })),
    setSessionConfig: vi.fn(async () => undefined),
    recordChatLink: vi.fn(async () => ({})),
    queueChatLink: vi.fn(),
    pendingChatLinks: {},
    loadPhaseRunsForSession: vi.fn(async () => undefined),
    setAgentDraft: vi.fn(),
    loadSetting: vi.fn(async (_key: string) => null as string | null),
    saveSetting: vi.fn(async (_key: string, _value: string) => undefined),
    reportError: vi.fn(),
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    agentDraft: {} as Record<string, string>,
    navigate: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  sessionPlace: ({ sessionId }: { readonly sessionId: string }) => ({ at: 'session', sessionId }),
  useSessionStages: (sessions: ReadonlyArray<{ readonly id: string }>) =>
    Object.fromEntries(
      sessions.map((session) => [session.id, store.stages[session.id] ?? 'building']),
    ),
  useProjectMountsForSessions: () => store.mounts,
  useAppStore: Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
  }),
}));

vi.mock('../../../providers/hooks/useHiddenModels', () => ({ useHiddenModels: () => ({}) }));

vi.mock('../../activeChatBackend', () => ({
  activeChatBackend: { summarizeForWork: summarize },
}));

import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { ChatRoom } from './index';

type RoomParams = {
  readonly chat: ChatSummary | null;
  readonly onCreated?: (chatId: ChatId) => void;
};

const renderRoom = ({ chat, onCreated = vi.fn() }: RoomParams) =>
  render(
    <ChatRoom workspaceId={WORKSPACE_ID} chat={chat} onCreated={onCreated} onRemoved={vi.fn()} />,
  );

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;
const CHAT_ID = 'chat-consent' as ChatId;
const AT = '2026-09-28T10:00:00.000Z' as IsoDateTime;

const CHAT: ChatSummary = {
  id: CHAT_ID,
  workspaceId: WORKSPACE_ID,
  title: 'Where is the consent step defined?',
  provider: 'anthropic',
  model: 'sonnet-5',
  effort: null,
  pinnedAt: null,
  archivedAt: null,
  lastActivityAt: AT,
  createdAt: AT,
  updatedAt: AT,
  preview: null,
  modelsUsed: [],
  messageCount: 0,
};

type MessageSeed = Pick<ChatMessage, 'role' | 'content' | 'status'> &
  Partial<Pick<ChatMessage, 'reads'>>;

const messageOf = ({ role, content, status, reads = [] }: MessageSeed): ChatMessage => ({
  id: `${role}-${status}` as ChatMessageId,
  chatId: CHAT_ID,
  role,
  content,
  status,
  reads,
  error: null,
  provider: null,
  model: null,
  effort: null,
  createdAt: AT,
  updatedAt: AT,
});

const SESSION_CONSENT = {
  id: 'session-consent',
  workspaceId: WORKSPACE_ID,
  goal: 'Ask for consent again when the policy changes',
  updatedAt: AT,
};

const SESSION_REFUNDS = {
  id: 'session-refunds',
  workspaceId: WORKSPACE_ID,
  goal: 'Refund flow for storefront-web',
  updatedAt: AT,
};

const LINK_NEW = {
  id: 'link-new',
  chatId: CHAT_ID,
  sessionId: 'session-consent',
  messageId: 'assistant-done',
  kind: 'new',
  createdAt: AT,
};

const LINK_ADD = {
  id: 'link-add',
  chatId: CHAT_ID,
  sessionId: 'session-refunds',
  messageId: null,
  kind: 'add',
  createdAt: AT,
};

beforeEach(() => {
  store.chatMessages = {};
  store.chatLinks = {};
  store.chatStreams = {};
  store.sessions = [];
  store.stages = {};
  store.mounts = {};
  store.sessionPhaseRuns = {};
  store.agentDraft = {};
  store.settings = {};
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  store.loadSetting.mockReset();
  store.loadSetting.mockResolvedValue(null);
});

const ANSWERED: ReadonlyArray<ChatMessage> = [
  messageOf({ role: 'user', content: 'Where is the consent step defined?', status: 'done' }),
  messageOf({ role: 'assistant', content: '**It lives in payments-api**', status: 'done' }),
];

describe('ChatRoom', () => {
  it('draws the title, the conversation and the composer on the page column', () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    const columns = Array.from(document.querySelectorAll('[data-page-column]'));
    const inColumn = (element: HTMLElement) =>
      columns.filter((column) => column.contains(element)).length;
    expect(columns.length).toBeGreaterThanOrEqual(3);
    expect(inColumn(screen.getByRole('heading', { name: CHAT.title }))).toBe(1);
    expect(inColumn(screen.getByRole('list', { name: 'Messages' }))).toBe(1);
    expect(inColumn(screen.getByRole('textbox', { name: 'Message' }))).toBe(1);
  });

  it('keeps the new chat prompt and its composer on the page column too', () => {
    renderRoom({ chat: null });

    const columns = Array.from(document.querySelectorAll('[data-page-column]'));
    const composer = screen.getByRole('textbox', { name: 'Message' });
    expect(columns.some((column) => column.contains(composer))).toBe(true);
    expect(
      columns.some((column) =>
        column.contains(screen.getByText(/Ask anything about/, { selector: 'h2' })),
      ),
    ).toBe(true);
  });

  it('creates a session with the summarized goal, records the link and opens it', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    const goal = await screen.findByDisplayValue(
      'Ask for consent again when the policy version changes.',
    );
    expect(goal).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    });

    expect(store.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      projectId: 'project-payments',
      title: 'Ask for consent again when the policy changes',
      goal: expect.stringContaining(
        'Ask for consent again when the policy version changes.\n\nWhat we know:\n- Consent is step 4, in steps.ts:88.',
      ),
    });
    expect(store.createSession.mock.calls[0]?.[0]).not.toHaveProperty('firstAgentKind');
    expect(store.createSession.mock.calls[0]?.[0]).not.toHaveProperty('kickoffPrompt');
    expect(store.recordChatLink).toHaveBeenCalledWith({
      chatId: CHAT_ID,
      sessionId: 'session-new',
      messageId: null,
      kind: 'new',
    });
    expect(store.navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({ at: 'session', sessionId: 'session-new' }),
    });
  });

  it('keeps the drawer open with the error when the session cannot be created', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    store.createSession.mockRejectedValueOnce(new Error('disk full'));
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    });

    expect(screen.getByText('disk full')).toBeDefined();
    expect(store.recordChatLink).not.toHaveBeenCalled();
    expect(store.navigate).not.toHaveBeenCalled();
  });

  it('says when the chat could not be linked and links it on Try again', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    store.recordChatLink.mockRejectedValueOnce(new Error('disk full'));
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    });

    screen.getByText("Couldn't link the chat to the session");
    expect(store.navigate).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });

    expect(screen.queryByText("Couldn't link the chat to the session")).toBeNull();
    expect(store.navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({ at: 'session', sessionId: 'session-new' }),
    });
  });

  it('picks several projects in the popover and starts the session in all of them', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');
    expect(screen.getByRole('button', { name: 'Remove payments-api' })).toBeDefined();

    fireEvent.click(screen.getByRole('combobox', { name: 'Project' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search projects' }), {
      target: { value: 'ledger' },
    });
    expect(screen.queryByRole('option', { name: /payments-api/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /ledger-core/ }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search projects' }), {
      key: 'Escape',
    });
    expect(screen.getByRole('button', { name: 'Remove ledger-core' })).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    });
    expect(store.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-payments',
        additionalProjectIds: ['project-ledger'],
      }),
    );
  });

  it('lays the project control full width under its label with the chips below', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');

    const trigger = screen.getByRole('combobox', { name: 'Project' });
    expect(trigger.className).toContain('w-full');
    const field = trigger.closest('div.flex-col');
    expect(field?.parentElement?.className).toContain('flex-col');
    expect(field?.previousElementSibling?.textContent).toBe('Project');
    const chip = screen.getByRole('button', { name: 'Remove payments-api' });
    expect(trigger.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chip.parentElement?.className).toContain('flex-wrap');
  });

  it('starts a session with no project once every chip is removed', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');
    fireEvent.click(screen.getByRole('button', { name: 'Remove payments-api' }));
    expect(screen.getByRole('combobox', { name: 'Project' }).textContent).toContain('No project');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    });
    expect(store.createSession).toHaveBeenCalledTimes(1);
    const input = store.createSession.mock.calls[0]?.[0];
    expect(input).not.toHaveProperty('projectId');
    expect(input).not.toHaveProperty('additionalProjectIds');
  });

  it('adds to a session picked from grouped rows and hides the project control', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    store.sessions = [
      {
        id: 'session-refunds',
        workspaceId: WORKSPACE_ID,
        goal: 'Refund flow for storefront-web',
        updatedAt: AT,
      },
      {
        id: 'session-audit',
        workspaceId: WORKSPACE_ID,
        goal: 'Audit ledger-core postings',
        updatedAt: AT,
      },
    ];
    store.stages = { 'session-audit': 'done' };
    store.mounts = { 'session-refunds': [{ projectId: 'project-payments' }] };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');
    fireEvent.click(screen.getByRole('tab', { name: 'Add to a session' }));
    expect(screen.queryByRole('combobox', { name: 'Project' })).toBeNull();
    const primary = screen.getByRole('button', { name: 'Add to session' });
    expect(primary.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('combobox', { name: 'Session' }));
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('Recent')).toBeDefined();
    const active = screen.getByRole('option', { name: /Refund flow/ });
    expect(active.textContent).toContain('payments-api');
    fireEvent.change(screen.getByRole('combobox', { name: 'Search sessions' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('No sessions match')).toBeDefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Search sessions' }), {
      target: { value: 'audit' },
    });
    fireEvent.click(screen.getByRole('option', { name: /Audit ledger-core/ }));

    expect(screen.getByRole('combobox', { name: 'Session' }).textContent).toContain(
      'Audit ledger-core postings',
    );
    expect(screen.getByRole('button', { name: 'Add to session' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('adds to a session by opening it with the brief as an unsent draft', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    store.sessions = [
      {
        id: 'session-refunds',
        workspaceId: WORKSPACE_ID,
        goal: 'Refund flow for storefront-web',
        updatedAt: AT,
      },
    ];
    store.sessionPhaseRuns = { 'session-refunds': [{ id: 'agent-refunds', ordinal: 1 }] };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');
    fireEvent.click(screen.getByRole('tab', { name: 'Add to a session' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Session' }));
    fireEvent.click(screen.getByRole('option', { name: /Refund flow/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add to session' }));
    });

    expect(store.createSession).not.toHaveBeenCalled();
    expect(store.recordChatLink).not.toHaveBeenCalled();
    expect(store.queueChatLink).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-refunds' }),
    );
    expect(store.setAgentDraft).toHaveBeenCalledWith(
      'agent-refunds',
      expect.stringMatching(/^Ask for consent again when the policy changes\n\nAsk for consent/),
    );
  });

  it('drafts the brief with the chat model and shows it under the title', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');

    expect(summarize).toHaveBeenCalledTimes(1);
    expect(summarize).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: 'sonnet-5' }),
    );
    const drafter = screen.getByRole('button', { name: /^Drafted by: / });
    expect(drafter.textContent).toContain('Sonnet 5');
    expect(drafter.textContent).toContain('Medium');
  });

  it('drafts with the model remembered for the workspace', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    store.settings = {
      'chat.workDrafter.ws-harborline': JSON.stringify({
        provider: 'anthropic',
        model: 'haiku-4.5',
      }),
    };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');

    expect(summarize).toHaveBeenCalledTimes(1);
    expect(summarize).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: 'haiku-4.5' }),
    );
  });

  it('drafts again and remembers the choice when Drafted by changes', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');
    fireEvent.click(screen.getByRole('button', { name: /^Drafted by: / }));
    const models = screen.getByRole('group', { name: 'Model' });
    await act(async () => {
      fireEvent.click(within(models).getByRole('button', { name: /Haiku/ }));
    });

    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');
    expect(summarize).toHaveBeenCalledTimes(2);
    expect(summarize).toHaveBeenLastCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: 'haiku-4.5' }),
    );
    expect(store.saveSetting).toHaveBeenCalledWith(
      'chat.workDrafter.ws-harborline',
      JSON.stringify({ provider: 'anthropic', model: 'haiku-4.5' }),
    );
  });

  it('puts Start as first and hides Runs on when adding to a session', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');

    const startAs = screen.getByRole('tablist', { name: 'Start as' });
    const title = screen.getByDisplayValue('Ask for consent again when the policy changes');
    expect(startAs.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Runs on')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Add to a session' }));
    expect(screen.queryByText('Runs on')).toBeNull();
  });

  it('sets the new session default model and effort when Runs on is changed', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await screen.findByDisplayValue('Ask for consent again when the policy version changes.');
    fireEvent.click(screen.getByRole('button', { name: /^Runs on: / }));
    const effort = screen.getByRole('group', { name: 'Effort' });
    fireEvent.click(within(effort).getByRole('button', { name: /Low/ }));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    });

    expect(store.setSessionConfig).toHaveBeenCalledWith(
      'session-new',
      expect.objectContaining({ effort: 'low', providerOverride: expect.any(String) }),
    );
  });

  it('starts from the keyboard with command and enter', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    const goal = await screen.findByDisplayValue(
      'Ask for consent again when the policy version changes.',
    );
    await act(async () => {
      fireEvent.keyDown(goal, { key: 'Enter', metaKey: true });
    });

    expect(store.createSession).toHaveBeenCalledTimes(1);
  });

  it('sizes and tones Copy like the other quiet actions under an answer', () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    const copy = screen.getByRole('button', { name: 'Copy the answer' });
    const startHere = screen.getByRole('button', { name: 'Start work from here' });
    for (const token of ['text-secondary', 'text-faint-foreground', 'h-6', 'px-1.5']) {
      expect(copy.classList.contains(token)).toBe(true);
      expect(startHere.classList.contains(token)).toBe(true);
    }
    expect(copy.classList.contains('text-muted-foreground')).toBe(false);
  });

  it('keeps the header to the title and Start work', () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('heading', { name: CHAT.title })).toBeDefined();
    expect(within(header).getByRole('button', { name: 'Start work' })).toBeDefined();
    expect(within(header).queryByText(/Read-only/)).toBeNull();
    expect(within(header).queryByText(/Harborline/)).toBeNull();
    expect(within(header).queryByText(/Sonnet/)).toBeNull();
  });

  it('puts the read-only hint in the composer and the keys in the Send tooltip', () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    expect(screen.getByText('Read-only · 2 projects')).toBeDefined();
    expect(screen.queryByText(/Shift\+Enter/)).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Hi' } });
    expect(tooltipTextOf({ element: screen.getByRole('button', { name: 'Send' }) })).toBe(
      'Enter to send · Shift+Enter for a new line',
    );
  });

  it('names the model and effort under the answer that used them', () => {
    store.chatMessages = {
      [CHAT_ID]: [
        ANSWERED[0]!,
        {
          ...ANSWERED[1]!,
          provider: 'codex',
          model: 'gpt-5.6-sol',
          effort: 'high',
        } as ChatMessage,
      ],
    };
    renderRoom({ chat: CHAT });

    expect(screen.getByText('GPT-5.6 Sol · High')).toBeDefined();
  });

  it('shows no sessions chip while the chat has no link', () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    expect(screen.queryByRole('button', { name: /Linked sessions/ })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('lists the linked sessions from the chip and opens one', () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    store.sessions = [SESSION_CONSENT];
    store.stages = { 'session-consent': 'running' };
    store.chatLinks = { [CHAT_ID]: [LINK_NEW] };
    renderRoom({ chat: CHAT });

    const chip = screen.getByRole('button', { name: '1 session: Linked sessions' });
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(chip);
    const dialog = screen.getByRole('dialog', { name: 'Linked sessions' });
    expect(within(dialog).getByText('Ask for consent again when the policy changes')).toBeDefined();
    expect(within(dialog).getByText(/running · started from this chat/)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: /^Open Ask for consent/ }));

    expect(store.navigate).toHaveBeenCalledWith({
      to: { at: 'session', sessionId: 'session-consent' },
    });
    expect(screen.queryByRole('dialog', { name: 'Linked sessions' })).toBeNull();
  });

  it('counts sessions and words an added one as added', () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    store.sessions = [SESSION_CONSENT, SESSION_REFUNDS];
    store.chatLinks = { [CHAT_ID]: [LINK_NEW, LINK_ADD] };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: '2 sessions: Linked sessions' }));
    const dialog = screen.getByRole('dialog', { name: 'Linked sessions' });
    expect(within(dialog).getByText(/added from this chat/)).toBeDefined();
  });

  it('hides a deleted session and drops the chip when none is left', () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    store.sessions = [{ ...SESSION_CONSENT, deletedAt: AT }];
    store.chatLinks = { [CHAT_ID]: [LINK_NEW] };
    renderRoom({ chat: CHAT });

    expect(screen.queryByRole('button', { name: /Linked sessions/ })).toBeNull();
    expect(screen.queryByText('Started a session ·')).toBeNull();
  });

  it('keeps the handoff note under the answer it came from, from the saved link', () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    store.sessions = [SESSION_CONSENT];
    store.chatLinks = { [CHAT_ID]: [LINK_NEW] };
    renderRoom({ chat: CHAT });

    const note = screen.getByRole('status');
    expect(note.textContent).toContain('Started a session');
    expect(note.textContent).toContain('Ask for consent again when the policy changes');
    const answer = screen.getByText('It lives in payments-api').closest('li');
    expect(answer?.nextElementSibling?.contains(note)).toBe(true);
    fireEvent.click(within(note).getByRole('button', { name: 'Open session' }));
    expect(store.navigate).toHaveBeenCalledWith({
      to: { at: 'session', sessionId: 'session-consent' },
    });
  });

  it('keeps Start work off until an answer is done', () => {
    store.chatMessages = { [CHAT_ID]: [ANSWERED[0]!] };
    renderRoom({ chat: CHAT });

    expect(screen.getByRole('button', { name: 'Start work' }).hasAttribute('disabled')).toBe(true);
  });

  it('creates the chat with the default model on the first send', async () => {
    const onCreated = vi.fn();
    renderRoom({ chat: null, onCreated });

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Where do we validate IBANs?' },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message' }), { key: 'Enter' });
    });

    expect(store.createChat).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      provider: 'anthropic',
      model: 'sonnet-5.5',
    });
    expect(onCreated).toHaveBeenCalledWith('chat-new');
    expect(store.sendChatMessage).toHaveBeenCalledWith({
      chatId: 'chat-new',
      content: 'Where do we validate IBANs?',
    });
  });

  it('shows the empty state with suggestions from the projects', async () => {
    renderRoom({ chat: null });

    expect(screen.getByRole('heading', { name: 'Ask anything about Harborline' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /What changed in payments-api/ }));
    await waitFor(() => expect(store.createChat).toHaveBeenCalled());
  });

  it('renders a streaming answer as it grows and offers Stop', () => {
    store.chatMessages = {
      [CHAT_ID]: [
        messageOf({ role: 'user', content: 'Where is the consent step defined?', status: 'done' }),
        messageOf({
          role: 'assistant',
          content: '**It lives in payments-api**',
          status: 'streaming',
          reads: ['payments-api/src/questionnaire/steps.ts'],
        }),
      ],
    };
    store.chatStreams = { [CHAT_ID]: { runId: 'run-1', messageId: 'x', isStopping: false } };
    renderRoom({ chat: CHAT });

    expect(screen.getByText('It lives in payments-api')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Read 1 file' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Stop the answer' }));
    expect(store.stopChatReply).toHaveBeenCalledWith({ chatId: CHAT_ID });
  });

  it('says it is reading before the first words arrive', () => {
    store.chatMessages = {
      [CHAT_ID]: [
        messageOf({ role: 'user', content: 'Why?', status: 'done' }),
        messageOf({ role: 'assistant', content: '', status: 'streaming' }),
      ],
    };
    store.chatStreams = { [CHAT_ID]: { runId: 'run-1', messageId: 'x', isStopping: false } };
    renderRoom({ chat: CHAT });

    expect(screen.getByRole('status').textContent).toBe('Reading Harborline');
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });

  it('offers the full picker with only chat providers and says why the others are out', () => {
    store.chatMessages = { [CHAT_ID]: [] };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: /^Model for this chat: / }));
    const dialog = screen.getByRole('dialog', { name: 'Model for this chat' });
    expect(within(dialog).getByText(/OpenCode can't chat/)).toBeDefined();
    expect(within(dialog).getByText(/Chat needs a provider that can run read-only/)).toBeDefined();
    expect(within(dialog).getByText('Effort')).toBeDefined();
    expect(within(dialog).queryByRole('button', { name: /OpenCode/ })).toBeNull();
  });

  it('saves the picked model and effort on the chat in one write', async () => {
    store.chatMessages = { [CHAT_ID]: [] };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: /^Model for this chat: / }));
    const dialog = screen.getByRole('dialog', { name: 'Model for this chat' });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'High' }));
    });

    expect(store.setChatModel).toHaveBeenCalledTimes(1);
    expect(store.setChatModel).toHaveBeenCalledWith({
      chatId: CHAT_ID,
      provider: 'anthropic',
      model: 'sonnet-5',
      effort: 'high',
    });
  });
  it('starts a new chat on the workspace default model and effort', () => {
    store.settings = {
      'chat.default_model.ws-harborline': JSON.stringify({
        provider: 'anthropic',
        model: 'opus-5',
        effort: 'high',
      }),
    };
    renderRoom({ chat: null });

    expect(
      screen.getByRole('button', { name: /^Model for this chat: / }).getAttribute('aria-label'),
    ).toMatch(/Opus 5/);
  });

  it('keeps the automatic model while no default is saved', () => {
    renderRoom({ chat: null });

    expect(
      screen.getByRole('button', { name: /^Model for this chat: / }).getAttribute('aria-label'),
    ).toMatch(/Sonnet 5/);
  });

  it('saves the picked model as the default for new chats from the picker footer', () => {
    store.chatMessages = { [CHAT_ID]: [] };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: /^Model for this chat: / }));
    const dialog = screen.getByRole('dialog', { name: 'Model for this chat' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make default' }));

    expect(store.saveSetting).toHaveBeenCalledWith(
      'chat.default_model.ws-harborline',
      JSON.stringify({ provider: 'anthropic', model: 'sonnet-5', effort: null }),
    );
  });

  it('offers to clear the default when the shown model is the default', () => {
    store.settings = {
      'chat.default_model.ws-harborline': JSON.stringify({
        provider: 'anthropic',
        model: 'sonnet-5',
        effort: null,
      }),
    };
    store.chatMessages = { [CHAT_ID]: [] };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: /^Model for this chat: / }));
    const dialog = screen.getByRole('dialog', { name: 'Model for this chat' });
    expect(within(dialog).queryByRole('button', { name: 'Make default' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to automatic' }));

    expect(store.saveSetting).toHaveBeenCalledWith('chat.default_model.ws-harborline', '');
  });

  it('names a different saved default instead of calling it automatic', () => {
    store.settings = {
      'chat.default_model.ws-harborline': JSON.stringify({
        provider: 'anthropic',
        model: 'opus-5',
        effort: null,
      }),
    };
    store.chatMessages = { [CHAT_ID]: [] };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: /^Model for this chat: / }));
    const dialog = screen.getByRole('dialog', { name: 'Model for this chat' });

    expect(within(dialog).queryByText('New chats start on automatic.')).toBeNull();
    expect(within(dialog).getByText('New chats use another default model.')).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Make default' })).toBeDefined();
  });

  it('waits for the saved default on a cold cache before creating the first chat', async () => {
    let resolveSaved: (value: string | null) => void = () => undefined;
    store.loadSetting.mockImplementation(
      () => new Promise<string | null>((resolve) => (resolveSaved = resolve)),
    );
    renderRoom({ chat: null });

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Where do we validate IBANs?' },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message' }), { key: 'Enter' });
    });
    expect(store.createChat).not.toHaveBeenCalled();

    await act(async () => {
      resolveSaved(JSON.stringify({ provider: 'anthropic', model: 'opus-5', effort: 'high' }));
    });

    expect(store.createChat).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      provider: 'anthropic',
      model: 'opus-5',
    });
    expect(store.setChatModel).toHaveBeenCalledWith({
      chatId: 'chat-new',
      provider: 'anthropic',
      model: 'opus-5',
      effort: 'high',
    });
  });

  it('falls back to automatic when reading the saved default fails', async () => {
    store.loadSetting.mockRejectedValue(new Error('db locked'));
    renderRoom({ chat: null });

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Where do we validate IBANs?' },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message' }), { key: 'Enter' });
    });

    expect(store.createChat).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      provider: 'anthropic',
      model: 'sonnet-5.5',
    });
    expect(store.reportError).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChatId,
  ChatSummary,
  IsoDateTime,
  Project,
  ProjectId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import type {
  ChatResponder,
  ChatResponderParams,
} from '../../../features/workspace-chat/createMemoryChatBackend';
import type { ChatBackend } from '../../../features/workspace-chat/chatBackend';
import { createMemoryChatBackend } from '../../../features/workspace-chat/createMemoryChatBackend';

const { holder } = vi.hoisted(() => ({
  holder: { backend: null as ChatBackend | null, respond: null as ChatResponder | null },
}));

vi.mock('../../../features/workspace-chat/activeChatBackend', () => ({
  activeChatBackend: new Proxy(
    {},
    {
      get: (_target, key) =>
        holder.backend === null ? undefined : Reflect.get(holder.backend, key),
    },
  ),
}));

import { createChatsSlice } from './index';
import { NO_PROJECT_MESSAGE } from './planChatTurn';
import { selectChatGroups } from './selectChatGroups';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const AT = '2026-09-28T09:00:00.000Z' as IsoDateTime;

const project = (patch: Partial<Project>): Project => ({
  id: 'payments' as ProjectId,
  workspaceId: WORKSPACE,
  name: 'payments-api',
  rootPath: '/Users/mara/code/harborline/payments-api',
  kind: 'repo',
  overrides: {} as Project['overrides'],
  createdAt: AT,
  updatedAt: AT,
  ...patch,
});

const WORKSPACE_ROW: Workspace = {
  id: WORKSPACE,
  name: 'Harborline',
  slug: 'harborline',
  overrides: {} as Project['overrides'],
  createdAt: AT,
  updatedAt: AT,
};

type HarnessParams = {
  readonly projects?: ReadonlyArray<Project>;
};

const harness = ({ projects }: HarnessParams) => {
  let state: Record<string, unknown> = {};
  const set = (
    patch: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>),
  ) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const get = () => state;
  const slice = createChatsSlice(set as never, get as never);
  state = {
    ...slice,
    projects: projects ?? [
      project({}),
      project({
        id: 'ledger' as ProjectId,
        name: 'ledger-core',
        rootPath: '/Users/mara/code/harborline/ledger-core',
      }),
    ],
    workspaces: [WORKSPACE_ROW],
  };
  return { slice, read: () => state as unknown as ReturnType<typeof createChatsSlice> };
};

type Gate = {
  readonly release: () => void;
  readonly started: Promise<ChatResponderParams>;
};

const gatedResponder = (): Gate => {
  let open: () => void = () => undefined;
  let reportStart: (params: ChatResponderParams) => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  const started = new Promise<ChatResponderParams>((resolve) => {
    reportStart = resolve;
  });
  holder.respond = async (params) => {
    reportStart(params);
    params.onRead('payments-api/src/questionnaire/steps.ts');
    params.onRead('payments-api/src/questionnaire/steps.ts');
    params.onText('**It lives in ');
    await opened;
    if (params.isCancelled()) {
      return { status: 'failed', error: 'killed' };
    }
    params.onText('payments-api.**');
    return { status: 'done' };
  };
  return { release: open, started };
};

beforeEach(() => {
  holder.respond = null;
  holder.backend = createMemoryChatBackend({
    respond: (params) => {
      if (holder.respond === null) {
        return Promise.resolve({ status: 'done' });
      }
      return holder.respond(params);
    },
  });
});

describe('chats slice', () => {
  it('creates a chat on top of the list with a placeholder title', async () => {
    const { slice, read } = harness({});

    const chatId = await slice.createChat({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });

    const [chat] = read().chatsByWorkspace[WORKSPACE] ?? [];
    expect(chat).toMatchObject({ id: chatId, title: 'New chat', provider: 'anthropic' });
    expect(read().chatMessages[chatId]).toEqual([]);
  });

  it('shows the question at once, streams the reply and saves it with the files it read', async () => {
    const gate = gatedResponder();
    const { slice, read } = harness({});
    const chatId = await slice.createChat({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });

    const sending = slice.sendChatMessage({ chatId, content: ' Where is the consent step? ' });
    const started = await gate.started;

    const live = read().chatMessages[chatId] ?? [];
    expect(live.map((message) => [message.role, message.status])).toEqual([
      ['user', 'done'],
      ['assistant', 'streaming'],
    ]);
    expect(live[1]?.content).toBe('**It lives in ');
    expect(live[1]?.reads).toEqual(['payments-api/src/questionnaire/steps.ts']);
    expect(read().chatStreams[chatId]).toBeDefined();
    expect(read().chatsByWorkspace[WORKSPACE]?.[0]?.title).toBe('Where is the consent step?');
    expect(started.request).toMatchObject({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      workingDir: '/Users/mara/code/harborline/ledger-core',
      prompt: 'Where is the consent step?',
    });
    expect(started.request.systemPrompt).toContain('Harborline workspace');

    gate.release();
    await sending;

    const [, reply] = read().chatMessages[chatId] ?? [];
    expect(reply).toMatchObject({
      status: 'done',
      content: '**It lives in payments-api.**',
      error: null,
    });
    expect(read().chatStreams[chatId]).toBeUndefined();
    expect(read().chatsByWorkspace[WORKSPACE]?.[0]?.preview).toBe('**It lives in payments-api.**');
    const saved = await holder.backend?.listMessages({ chatId });
    expect(saved?.[1]).toMatchObject({
      status: 'done',
      content: '**It lives in payments-api.**',
      reads: ['payments-api/src/questionnaire/steps.ts'],
    });
  });

  it('sends the earlier turns with the next question', async () => {
    const { slice } = harness({});
    const prompts: string[] = [];
    holder.respond = async (params) => {
      prompts.push(params.request.prompt);
      params.onText('**Answer.**');
      return { status: 'done' };
    };
    const chatId = await slice.createChat({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });

    await slice.sendChatMessage({ chatId, content: 'Where is the consent step?' });
    await slice.sendChatMessage({ chatId, content: 'Who reads it?' });

    expect(prompts[1]).toContain('User: Where is the consent step?');
    expect(prompts[1]).toContain('Assistant: **Answer.**');
    expect(prompts[1]?.endsWith('New question:\nWho reads it?')).toBe(true);
  });

  it('keeps the partial answer as stopped when the user stops it', async () => {
    const gate = gatedResponder();
    const { slice, read } = harness({});
    const chatId = await slice.createChat({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });
    const sending = slice.sendChatMessage({ chatId, content: 'Where is the consent step?' });
    await gate.started;

    await slice.stopChatReply({ chatId });
    gate.release();
    await sending;

    const [, reply] = read().chatMessages[chatId] ?? [];
    expect(reply).toMatchObject({ status: 'stopped', content: '**It lives in ', error: null });
  });

  it('fails the reply with a clear reason when the workspace has no project', async () => {
    const { slice, read } = harness({ projects: [] });
    const chatId = await slice.createChat({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });

    await slice.sendChatMessage({ chatId, content: 'Where is the consent step?' });

    const [, reply] = read().chatMessages[chatId] ?? [];
    expect(reply).toMatchObject({ status: 'failed', error: NO_PROJECT_MESSAGE });
  });

  it('ignores an empty message and a second message while one is answering', async () => {
    const gate = gatedResponder();
    const { slice, read } = harness({});
    const chatId = await slice.createChat({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });

    await slice.sendChatMessage({ chatId, content: '   ' });
    expect(read().chatMessages[chatId]).toEqual([]);

    const sending = slice.sendChatMessage({ chatId, content: 'First' });
    await gate.started;
    await slice.sendChatMessage({ chatId, content: 'Second' });
    expect(read().chatMessages[chatId]).toHaveLength(2);
    gate.release();
    await sending;
  });

  it('archives chats out of the list and brings them back on undo', async () => {
    const { slice, read } = harness({});
    const chatId = await slice.createChat({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });

    await slice.archiveChats({ workspaceId: WORKSPACE, chatIds: [chatId] });
    expect(read().chatsByWorkspace[WORKSPACE]).toEqual([]);

    await slice.restoreChats({ workspaceId: WORKSPACE, chatIds: [chatId] });
    expect(read().chatsByWorkspace[WORKSPACE]?.map((chat) => chat.id)).toEqual([chatId]);
  });

  it('archives only the idle chats and returns them for undo', async () => {
    const { slice, read } = harness({});
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() as IsoDateTime;
    await holder.backend?.insertChat({
      chat: {
        id: 'lunch' as ChatId,
        workspaceId: WORKSPACE,
        title: 'Lunch ideas near the office',
        provider: 'anthropic',
        model: 'sonnet-5',
        pinnedAt: null,
        archivedAt: null,
        lastActivityAt: old,
        createdAt: old,
        updatedAt: old,
      },
    });
    const fresh = await slice.createChat({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });
    await slice.loadChats({ workspaceId: WORKSPACE });

    const archived = await slice.archiveIdleChats({ workspaceId: WORKSPACE });

    expect(archived).toEqual(['lunch']);
    expect(read().chatsByWorkspace[WORKSPACE]?.map((chat) => chat.id)).toEqual([fresh]);
    await slice.restoreChats({ workspaceId: WORKSPACE, chatIds: archived });
    expect(read().chatsByWorkspace[WORKSPACE]).toHaveLength(2);
  });

  it('refuses a chat on a provider that cannot run read-only', async () => {
    const { slice, read } = harness({});

    await expect(
      slice.createChat({ workspaceId: WORKSPACE, provider: 'cursor', model: 'auto' }),
    ).rejects.toThrow('Chat needs a provider that can run read-only: Claude or Codex');
    const chatId = await slice.createChat({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });
    await expect(
      slice.setChatModel({ chatId, provider: 'gemini', model: 'gemini-3' }),
    ).rejects.toThrow('Claude or Codex');
    expect(read().chatsByWorkspace[WORKSPACE]?.[0]?.provider).toBe('anthropic');
  });

  it('pins, renames and switches the model of a chat', async () => {
    const { slice, read } = harness({});
    const chatId = await slice.createChat({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });

    await slice.pinChat({ chatId, isPinned: true });
    await slice.renameChat({ chatId, title: '  Consent step  ' });
    await slice.setChatModel({ chatId, provider: 'codex', model: 'gpt-5.6-sol' });

    const [chat] = read().chatsByWorkspace[WORKSPACE] ?? [];
    expect(chat?.pinnedAt).not.toBeNull();
    expect(chat).toMatchObject({ title: 'Consent step', provider: 'codex', model: 'gpt-5.6-sol' });
    await slice.loadChats({ workspaceId: WORKSPACE });
    expect(read().chatsByWorkspace[WORKSPACE]?.[0]).toMatchObject({
      title: 'Consent step',
      provider: 'codex',
    });
  });
});

describe('selectChatGroups', () => {
  const NOW = Date.parse('2026-09-28T15:00:00.000Z');
  const chat = (id: string, lastActivityAt: string, pinnedAt: string | null = null) =>
    ({
      id: id as ChatId,
      workspaceId: WORKSPACE,
      title: id,
      provider: 'anthropic',
      model: 'sonnet-5',
      pinnedAt,
      archivedAt: null,
      lastActivityAt,
      createdAt: lastActivityAt,
      updatedAt: lastActivityAt,
      preview: null,
    }) as ChatSummary;

  it('groups pinned, today, this week and idle after seven days without activity', () => {
    const groups = selectChatGroups({
      chats: [
        chat('lunch', '2026-09-19T12:00:00.000Z'),
        chat('consent', '2026-09-28T14:00:00.000Z'),
        chat('release', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z'),
        chat('rounding', '2026-09-24T10:00:00.000Z'),
        chat('edge', '2026-09-21T15:00:00.000Z'),
      ],
      now: NOW,
    });

    expect(groups.pinned.map((entry) => entry.id)).toEqual(['release']);
    expect(groups.today.map((entry) => entry.id)).toEqual(['consent']);
    expect(groups.week.map((entry) => entry.id)).toEqual(['rounding']);
    expect(groups.idle.map((entry) => entry.id)).toEqual(['edge', 'lunch']);
  });
});

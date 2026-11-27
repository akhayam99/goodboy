// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppStore } from '../../../store/store';
import { clearActionLedger } from './actionLedger';
import { clearRateSlots } from './actionLimits';
import { chatMessagesOf } from './chatMessagesOf';
import type { StartPorts } from './handlerTypes';
import { executePhoneAction } from './executePhoneAction';
import { parsePhoneAction, phoneKindOf } from './parsePhoneAction';
import { registerPhoneScope, resetPhoneScope } from './phonePermissionScope';
import { chatSendVersionOf, createChatActionIdOf, sendChatActionIdOf } from './phoneActionIds';
import { clearSendSequences } from './sendSequence';

vi.mock('../../workspace-chat/defaultRoutingOfWorkspace', () => ({
  defaultRoutingOfWorkspace: vi.fn(async () => ({
    provider: 'anthropic',
    model: 'claude-opus-5',
    effort: null,
  })),
}));

const WORKSPACE = 'ws-harborline';
const OTHER_WORKSPACE = 'ws-northwind';
const CHAT = 'chat-ledger';
const OTHER_CHAT = 'chat-notify';
const NOW = Date.parse('2026-11-27T09:00:00.000Z');

type KitOptions = {
  readonly isBusy?: boolean;
};

const messageOf = (id: string, role: 'user' | 'assistant', content: string) => ({
  id,
  chatId: CHAT,
  role,
  content,
  status: 'done',
  error: null,
  createdAt: '2026-11-27T08:00:00.000Z',
});

const kitOf = ({ isBusy = false }: KitOptions = {}) => {
  const state = {
    workspaces: [{ id: WORKSPACE }, { id: OTHER_WORKSPACE }],
    chatsByWorkspace: {
      [WORKSPACE]: [
        { id: CHAT, archivedAt: null },
        { id: 'chat-old', archivedAt: 'x' },
      ],
      [OTHER_WORKSPACE]: [{ id: OTHER_CHAT, archivedAt: null }],
    },
    chatStreams: isBusy ? { [CHAT]: { runId: 'r', messageId: 'm', isStopping: false } } : {},
    chatMessages: {
      [CHAT]: [
        messageOf('m1', 'user', 'How do I round?'),
        messageOf('m2', 'assistant', 'Round at the edge of /Users/someone/ledger/notes.md'),
        messageOf('m3', 'user', 'Thanks'),
      ],
      [OTHER_CHAT]: [messageOf('x1', 'user', 'Retry window?')],
    },
  };
  const sendChatMessage = vi.fn(async () => {
    Reflect.set(store, 'chatStreams', {
      [CHAT]: { runId: 'r', messageId: 'm', isStopping: false },
    });
    return true;
  });
  const createChat = vi.fn(async () => 'chat-new');
  const setChatModel = vi.fn(async () => undefined);
  const loadChatMessages = vi.fn(async () => undefined);
  const store: AppStore = Object.assign(Object.create(null), state, {
    sendChatMessage,
    createChat,
    setChatModel,
    loadChatMessages,
  });
  return { store, sendChatMessage, createChat, setChatModel };
};

const portsOf = (): StartPorts => Object.create(null);

type SendParams = {
  readonly chatId?: string;
  readonly workspaceId?: string;
  readonly text?: string;
  readonly version?: string;
};

const sendOf = ({
  chatId = CHAT,
  workspaceId = WORKSPACE,
  text = 'And the rest?',
  version = chatSendVersionOf({ chatId }),
}: SendParams = {}) => {
  const action = parsePhoneAction({
    raw: {
      kind: 'sendChatMessage',
      actionId: sendChatActionIdOf({ chatId, version }),
      workspaceId,
      chatId,
      seenVersion: version,
      text,
    },
  });
  if (action === null) {
    throw new Error('send action did not parse');
  }
  return action;
};

const createOf = ({ workspaceId = WORKSPACE }: { readonly workspaceId?: string } = {}) => {
  const action = parsePhoneAction({
    raw: {
      kind: 'createChat',
      actionId: createChatActionIdOf({ workspaceId }),
      workspaceId,
    },
  });
  if (action === null) {
    throw new Error('create action did not parse');
  }
  return action;
};

beforeEach(() => {
  clearActionLedger();
  clearRateSlots();
  clearSendSequences();
  resetPhoneScope();
});

describe('sendChatMessage', () => {
  it('parses only with a chat, a seen version and a text', () => {
    expect(phoneKindOf({ kind: 'sendChatMessage' })).toBe('sendChatMessage');
    expect(
      parsePhoneAction({ raw: { kind: 'sendChatMessage', actionId: 'a', workspaceId: 'w' } }),
    ).toBeNull();
    expect(sendOf().kind).toBe('sendChatMessage');
  });

  it('sends the text to the chat the action names and answers once the reply started', async () => {
    const kit = kitOf();

    const outcome = await executePhoneAction({
      action: sendOf(),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });

    expect(outcome.result).toBe('done');
    expect(kit.sendChatMessage).toHaveBeenCalledWith({ chatId: CHAT, content: 'And the rest?' });
    expect(chatSendVersionOf({ chatId: CHAT })).toBe('1');
  });

  it('answers a retry of the same action with the first outcome and sends once', async () => {
    const kit = kitOf();
    const action = sendOf();

    const first = await executePhoneAction({
      action,
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });
    const again = await executePhoneAction({
      action,
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });

    expect(first.result).toBe('done');
    expect(again.isReplay).toBe(true);
    expect(kit.sendChatMessage).toHaveBeenCalledTimes(1);
  });

  it('refuses an id the Mac did not offer for that version', async () => {
    const kit = kitOf();
    const action = sendOf();

    const outcome = await executePhoneAction({
      action: { ...action, actionId: 'act:sendChatMessage:chat-other:0' },
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });

    expect(outcome.refusal?.code).toBe('unknown-target');
    expect(kit.sendChatMessage).not.toHaveBeenCalled();
  });

  it('refuses a version that moved on and names what changed', async () => {
    const kit = kitOf();
    await executePhoneAction({
      action: sendOf(),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });
    Reflect.set(kit.store, 'chatStreams', {});

    const outcome = await executePhoneAction({
      action: sendOf({ version: '9', text: 'A second one' }),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW + 1,
    });

    expect(outcome.refusal?.code).toBe('version-changed');
    expect(outcome.refusal?.changes[0]).toEqual({ label: 'Messages', was: '9', now: '1' });
    expect(kit.sendChatMessage).toHaveBeenCalledTimes(1);
  });

  it('refuses a chat of another workspace, an archived chat and an unknown chat', async () => {
    const kit = kitOf();
    for (const action of [
      sendOf({ chatId: OTHER_CHAT }),
      sendOf({ chatId: 'chat-old' }),
      sendOf({ chatId: 'chat-missing' }),
    ]) {
      const outcome = await executePhoneAction({
        action,
        phoneId: null,
        getStore: () => kit.store,
        ports: portsOf(),
        now: NOW,
      });
      expect(outcome.refusal?.code).toBe('unknown-target');
    }
    expect(kit.sendChatMessage).not.toHaveBeenCalled();
  });

  it('refuses while the chat is still answering', async () => {
    const kit = kitOf({ isBusy: true });

    const outcome = await executePhoneAction({
      action: sendOf(),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });

    expect(outcome.refusal?.code).toBe('busy');
    expect(kit.sendChatMessage).not.toHaveBeenCalled();
  });

  it('fails an empty message and a send the Mac refused to start', async () => {
    const kit = kitOf();
    const empty = await executePhoneAction({
      action: sendOf({ text: '   ' }),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });
    expect(empty.result).toBe('failed');

    kit.sendChatMessage.mockResolvedValueOnce(false);
    const refused = await executePhoneAction({
      action: sendOf({ text: 'Try again' }),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW + 1,
    });
    expect(refused.result).toBe('failed');
    expect(chatSendVersionOf({ chatId: CHAT })).toBe('0');
  });

  it('is refused for a phone that may not decide, and rate limited', async () => {
    const kit = kitOf();
    registerPhoneScope({ read: ({ permission }) => permission !== 'decide' });
    const denied = await executePhoneAction({
      action: sendOf(),
      phoneId: 'phone-1',
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });
    expect(denied.refusal?.code).toBe('not-permitted');
    resetPhoneScope();

    for (let index = 0; index < 20; index += 1) {
      await executePhoneAction({
        action: sendOf({ version: String(index + 1), text: `m${index}` }),
        phoneId: null,
        getStore: () => kit.store,
        ports: portsOf(),
        now: NOW + index,
      });
    }
    const limited = await executePhoneAction({
      action: sendOf({ version: '99' }),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW + 100,
    });
    expect(limited.refusal?.code).toBe('rate-limited');
  });
});

describe('createChat', () => {
  it('creates a chat in the workspace the action names with the Mac default routing', async () => {
    const kit = kitOf();

    const outcome = await executePhoneAction({
      action: createOf(),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });

    expect(outcome.result).toBe('done');
    expect(outcome.createdChatId).toBe('chat-new');
    expect(outcome.createdSessionId).toBeNull();
    expect(kit.createChat).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'claude-opus-5',
    });
    expect(kit.setChatModel).not.toHaveBeenCalled();
  });

  it('creates one chat for a retry of the same action', async () => {
    const kit = kitOf();
    const action = createOf();
    const run = () =>
      executePhoneAction({
        action,
        phoneId: null,
        getStore: () => kit.store,
        ports: portsOf(),
        now: NOW,
      });

    const first = await run();
    const again = await run();

    expect(again.createdChatId).toBe(first.createdChatId);
    expect(kit.createChat).toHaveBeenCalledTimes(1);
  });

  it('refuses a workspace the Mac does not hold and an id from before a creation', async () => {
    const kit = kitOf();
    const unknown = await executePhoneAction({
      action: createOf({ workspaceId: 'ws-missing' }),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });
    expect(unknown.refusal?.code).toBe('unknown-target');

    const stale = createOf();
    await executePhoneAction({
      action: createOf(),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });
    const afterwards = await executePhoneAction({
      action: { ...stale, actionId: `act:createChat:${WORKSPACE}:7` },
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW + 1,
    });
    expect(afterwards.refusal?.code).toBe('unknown-target');
  });

  it('fails with a plain message when the chat could not be created', async () => {
    const kit = kitOf();
    kit.createChat.mockRejectedValueOnce(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const outcome = await executePhoneAction({
      action: createOf(),
      phoneId: null,
      getStore: () => kit.store,
      ports: portsOf(),
      now: NOW,
    });

    expect(outcome.result).toBe('failed');
    expect(outcome.error).toBe("Couldn't start the chat.");
  });
});

describe('queryChatMessages', () => {
  it('pages the messages of one chat with the paths cut to a name', async () => {
    const kit = kitOf();

    const page = await chatMessagesOf({
      query: { workspaceId: WORKSPACE, chatId: CHAT, limit: 2, beforeMessageId: null },
      getStore: () => kit.store,
    });

    expect(page?.messages.map((message) => message.id)).toEqual(['m2', 'm3']);
    expect(page?.hasEarlier).toBe(true);
    expect(page?.messages[0]?.text).not.toContain('/Users/');
    expect(page?.messages[1]).toMatchObject({ role: 'user', state: 'done', text: 'Thanks' });
    expect(page?.isBusy).toBe(false);

    const earlier = await chatMessagesOf({
      query: { workspaceId: WORKSPACE, chatId: CHAT, limit: 2, beforeMessageId: 'm2' },
      getStore: () => kit.store,
    });
    expect(earlier?.messages.map((message) => message.id)).toEqual(['m1']);
    expect(earlier?.hasEarlier).toBe(false);
  });

  it('never returns a chat for another workspace, an archived chat or an unknown one', async () => {
    const kit = kitOf();
    for (const query of [
      { workspaceId: WORKSPACE, chatId: OTHER_CHAT },
      { workspaceId: OTHER_WORKSPACE, chatId: CHAT },
      { workspaceId: WORKSPACE, chatId: 'chat-old' },
      { workspaceId: WORKSPACE, chatId: 'chat-missing' },
    ]) {
      const page = await chatMessagesOf({
        query: { ...query, limit: 10, beforeMessageId: null },
        getStore: () => kit.store,
      });
      expect(page).toBeNull();
    }
  });

  it('says the chat is busy while a reply streams and keeps the messages of that chat only', async () => {
    const kit = kitOf({ isBusy: true });

    const page = await chatMessagesOf({
      query: { workspaceId: WORKSPACE, chatId: CHAT, limit: 10, beforeMessageId: null },
      getStore: () => kit.store,
    });

    expect(page?.isBusy).toBe(true);
    expect(page?.chatId).toBe(CHAT);
    expect(page?.messages.map((message) => message.id)).toEqual(['m1', 'm2', 'm3']);
  });
});

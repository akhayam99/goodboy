// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  ChatId,
  ChatSessionLink,
  ChatSessionLinkId,
  ChatSessionLinkKind,
  IsoDateTime,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { selectChatOriginsBySession } from './selectChatOrigins';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;
const SESSION_ID = 'session-duplicate-credit' as SessionId;

type LinkParams = {
  readonly chatId: string;
  readonly kind: ChatSessionLinkKind;
  readonly at: string;
  readonly sessionId?: SessionId;
};

const linkOf = ({ chatId, kind, at, sessionId = SESSION_ID }: LinkParams): ChatSessionLink => ({
  id: `link-${chatId}-${kind}-${at}` as ChatSessionLinkId,
  chatId: chatId as ChatId,
  sessionId,
  messageId: null,
  kind,
  createdAt: at as IsoDateTime,
});

const chatOf = (id: string, title: string) => ({ id: id as ChatId, title });

const CHATS = {
  [WORKSPACE_ID]: [
    chatOf('chat-retry', 'Payments retry design'),
    chatOf('chat-rounding', 'Ledger rounding'),
  ],
};

describe('selectChatOriginsBySession', () => {
  it('lists every chat linked to a session, the one that started it first', () => {
    const origins = selectChatOriginsBySession({
      chatLinks: {
        ['chat-rounding' as ChatId]: [linkOf({ chatId: 'chat-rounding', kind: 'add', at: '1' })],
        ['chat-retry' as ChatId]: [linkOf({ chatId: 'chat-retry', kind: 'new', at: '2' })],
      },
      chatsByWorkspace: CHATS,
      archivedChatsByWorkspace: {},
    });

    expect(origins.get(SESSION_ID)).toEqual([
      { chatId: 'chat-retry', title: 'Payments retry design', kind: 'new' },
      { chatId: 'chat-rounding', title: 'Ledger rounding', kind: 'add' },
    ]);
  });

  it('names a chat once even when it both started and fed the session', () => {
    const origins = selectChatOriginsBySession({
      chatLinks: {
        ['chat-retry' as ChatId]: [
          linkOf({ chatId: 'chat-retry', kind: 'add', at: '3' }),
          linkOf({ chatId: 'chat-retry', kind: 'new', at: '2' }),
        ],
      },
      chatsByWorkspace: CHATS,
      archivedChatsByWorkspace: {},
    });

    expect(origins.get(SESSION_ID)?.map((origin) => origin.kind)).toEqual(['new']);
  });

  it('builds the map once for the same links and chats', () => {
    const state = {
      chatLinks: {
        ['chat-retry' as ChatId]: [linkOf({ chatId: 'chat-retry', kind: 'new', at: '1' })],
      },
      chatsByWorkspace: CHATS,
      archivedChatsByWorkspace: {},
    };

    expect(selectChatOriginsBySession(state)).toBe(selectChatOriginsBySession({ ...state }));
  });
});

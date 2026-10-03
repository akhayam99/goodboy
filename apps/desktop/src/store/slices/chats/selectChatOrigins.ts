import type {
  ChatId,
  ChatSessionLink,
  ChatSessionLinkKind,
  ChatSummary,
  SessionId,
} from '@goodboy/types';
import type { ChatsState } from './state';

export type ChatOrigin = {
  readonly chatId: ChatId;
  readonly title: string;
  readonly kind: ChatSessionLinkKind;
};

type TitledChat = Pick<ChatSummary, 'id' | 'title'>;

type ChatsByWorkspace = Readonly<Record<string, ReadonlyArray<TitledChat>>>;

type OriginState = Pick<ChatsState, 'chatLinks'> & {
  readonly chatsByWorkspace: ChatsByWorkspace;
  readonly archivedChatsByWorkspace: ChatsByWorkspace;
};

type Cache = {
  readonly links: OriginState['chatLinks'];
  readonly live: OriginState['chatsByWorkspace'];
  readonly archived: OriginState['archivedChatsByWorkspace'];
  readonly origins: ReadonlyMap<SessionId, ReadonlyArray<ChatOrigin>>;
};

let cache: Cache | null = null;

const KIND_ORDER: Record<ChatSessionLinkKind, number> = { new: 0, add: 1 };

const titlesOf = ({ live, archived }: Pick<Cache, 'live' | 'archived'>): Map<ChatId, string> => {
  const titles = new Map<ChatId, string>();
  const add = (chats: ReadonlyArray<TitledChat>) => {
    for (const chat of chats) {
      titles.set(chat.id, chat.title);
    }
  };
  Object.values(archived).forEach(add);
  Object.values(live).forEach(add);
  return titles;
};

const compareLinks = (a: ChatSessionLink, b: ChatSessionLink): number => {
  const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (byKind !== 0) {
    return byKind;
  }
  return a.createdAt.localeCompare(b.createdAt);
};

const buildOrigins = (state: OriginState): ReadonlyMap<SessionId, ReadonlyArray<ChatOrigin>> => {
  const titles = titlesOf({
    live: state.chatsByWorkspace,
    archived: state.archivedChatsByWorkspace,
  });
  const linksBySession = new Map<SessionId, Array<ChatSessionLink>>();
  for (const links of Object.values(state.chatLinks)) {
    for (const link of links) {
      linksBySession.set(link.sessionId, [...(linksBySession.get(link.sessionId) ?? []), link]);
    }
  }
  const origins = new Map<SessionId, ReadonlyArray<ChatOrigin>>();
  for (const [sessionId, links] of linksBySession) {
    const seen = new Set<ChatId>();
    const list: Array<ChatOrigin> = [];
    for (const link of [...links].sort(compareLinks)) {
      const title = titles.get(link.chatId);
      if (seen.has(link.chatId) || title === undefined) {
        continue;
      }
      seen.add(link.chatId);
      list.push({ chatId: link.chatId, title, kind: link.kind });
    }
    if (list.length > 0) {
      origins.set(sessionId, list);
    }
  }
  return origins;
};

const NO_RECORDS = {};

export const selectChatOriginsBySession = (
  loose: Partial<OriginState>,
): ReadonlyMap<SessionId, ReadonlyArray<ChatOrigin>> => {
  const state: OriginState = {
    chatLinks: loose.chatLinks ?? NO_RECORDS,
    chatsByWorkspace: loose.chatsByWorkspace ?? NO_RECORDS,
    archivedChatsByWorkspace: loose.archivedChatsByWorkspace ?? NO_RECORDS,
  };
  if (
    cache !== null &&
    cache.links === state.chatLinks &&
    cache.live === state.chatsByWorkspace &&
    cache.archived === state.archivedChatsByWorkspace
  ) {
    return cache.origins;
  }
  const origins = buildOrigins(state);
  cache = {
    links: state.chatLinks,
    live: state.chatsByWorkspace,
    archived: state.archivedChatsByWorkspace,
    origins,
  };
  return origins;
};

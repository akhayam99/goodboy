import { describe, expect, it } from 'vitest';
import type { ChatId, ChatSummary, IsoDateTime, WorkspaceId } from '@goodboy/types';
import { mostRecentChat, selectChatDoor } from './selectChatDoor';

const WORKSPACE = 'ws-harborline' as WorkspaceId;

const chat = ({ key, at }: { readonly key: string; readonly at: string }): ChatSummary => ({
  id: `chat-${key}` as ChatId,
  workspaceId: WORKSPACE,
  title: key,
  provider: 'anthropic',
  model: 'sonnet-5',
  effort: 'medium',
  pinnedAt: null,
  archivedAt: null,
  lastActivityAt: at as IsoDateTime,
  createdAt: at as IsoDateTime,
  updatedAt: at as IsoDateTime,
  preview: null,
  modelsUsed: [],
  messageCount: 0,
});

const NEWEST = chat({ key: 'newest', at: '2026-09-30T10:00:00.000Z' });
const MIDDLE = chat({ key: 'middle', at: '2026-09-30T09:00:00.000Z' });
const OLDEST = chat({ key: 'oldest', at: '2026-09-29T09:00:00.000Z' });

type DoorParams = {
  readonly remembered?: ChatId | null;
  readonly chats?: ReadonlyArray<ChatSummary>;
  readonly workspaceId?: WorkspaceId | null;
};

const doorOf = ({ remembered, chats, workspaceId = WORKSPACE }: DoorParams): ChatId | null =>
  selectChatDoor({
    state: {
      currentWorkspaceId: workspaceId,
      lastChatByWorkspace: remembered === undefined ? {} : { [WORKSPACE]: remembered },
      chatsByWorkspace: chats === undefined ? {} : { [WORKSPACE]: chats },
    },
  });

describe('selectChatDoor', () => {
  it('returns the remembered chat while it still exists', () => {
    expect(doorOf({ remembered: OLDEST.id, chats: [NEWEST, MIDDLE, OLDEST] })).toBe(OLDEST.id);
  });

  it('returns the most recent chat when nothing was remembered', () => {
    expect(doorOf({ chats: [OLDEST, NEWEST, MIDDLE] })).toBe(NEWEST.id);
  });

  it('returns the most recent chat when the remembered one is gone', () => {
    expect(doorOf({ remembered: 'chat-gone' as ChatId, chats: [OLDEST, MIDDLE] })).toBe(MIDDLE.id);
  });

  it('returns a new chat after New chat, whatever exists', () => {
    expect(doorOf({ remembered: null, chats: [NEWEST] })).toBeNull();
  });

  it('returns a new chat with no chats and no workspace', () => {
    expect(doorOf({ chats: [] })).toBeNull();
    expect(doorOf({ chats: [NEWEST], workspaceId: null })).toBeNull();
  });

  it('trusts the remembered chat while the list has not loaded', () => {
    expect(doorOf({ remembered: MIDDLE.id })).toBe(MIDDLE.id);
  });
});

describe('mostRecentChat', () => {
  it('skips the excluded chats', () => {
    expect(mostRecentChat({ chats: [NEWEST, MIDDLE, OLDEST], excluding: [NEWEST.id] })).toBe(
      MIDDLE.id,
    );
    expect(mostRecentChat({ chats: [NEWEST], excluding: [NEWEST.id] })).toBeNull();
    expect(mostRecentChat({ chats: [] })).toBeNull();
  });
});

// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatId } from '@goodboy/types';
import { readUnreadChats, writeUnreadChats } from './unreadStorage';

const KEY = 'goodboy:chat-unread:v1';

beforeEach(() => {
  localStorage.clear();
});

describe('unread chat storage', () => {
  it('reads nothing when nothing was saved', () => {
    expect(readUnreadChats()).toEqual([]);
  });

  it('gives back the chats it saved so an unread reply survives a reload', () => {
    writeUnreadChats({ chatIds: ['chat-1' as ChatId, 'chat-2' as ChatId] });

    expect(readUnreadChats()).toEqual(['chat-1', 'chat-2']);
  });

  it('ignores a value that is not a list of ids', () => {
    localStorage.setItem(KEY, '{not json');
    expect(readUnreadChats()).toEqual([]);

    localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    expect(readUnreadChats()).toEqual([]);

    localStorage.setItem(KEY, JSON.stringify(['chat-1', 4, null]));
    expect(readUnreadChats()).toEqual(['chat-1']);
  });
});

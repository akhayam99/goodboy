import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import type { SlackMessage, SlackUser } from './client';
import { slackConversation } from './slackConversation';

const message = (ts: string, userId: string | null, text: string): SlackMessage => ({
  ts,
  threadTs: '1.0',
  userId,
  botId: null,
  text,
  subtype: null,
  replyCount: 0,
  replyUserCount: 0,
  postedAt: '2026-08-05T09:00:00Z' as IsoDateTime,
  latestReplyAt: null,
  reactions: [],
});

const JUN: SlackUser = {
  id: 'U1',
  name: 'Jun Ota',
  isBot: false,
  isDeleted: false,
  avatarUrl: 'https://slack.example/jun.png',
};

describe('slackConversation', () => {
  it('keeps every message of the thread as one flat entry keyed by its ts', () => {
    const threads = slackConversation({
      messages: [message('1.0', 'U1', 'queue is at 4k'), message('2.0', 'U1', '*draining*')],
      usersById: new Map([[JUN.id, JUN]]),
      userNames: new Map([[JUN.id, JUN.name]]),
      channelNames: new Map(),
    });

    expect(threads.map((thread) => thread.id)).toEqual(['1.0', '2.0']);
    expect(threads[0]?.head.author.name).toBe('Jun Ota');
    expect(threads[1]?.head.body).toBe('**draining**');
  });

  it('falls back to the user id when the author is unknown', () => {
    const [thread] = slackConversation({
      messages: [message('1.0', 'U9', 'hi')],
      usersById: new Map(),
      userNames: new Map(),
      channelNames: new Map(),
    });

    expect(thread?.head.author.name).toBe('U9');
  });
});

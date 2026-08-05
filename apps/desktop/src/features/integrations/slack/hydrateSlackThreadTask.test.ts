import { describe, expect, it } from 'vitest';
import type { SlackChannel, SlackMessage } from './client';
import { hydrateSlackThreadTask } from './hydrateSlackThreadTask';

const CHANNELS = [
  { id: 'C024BE7LR', name: 'eng-alerts', isMember: true, topic: null, memberCount: 4 },
] as ReadonlyArray<SlackChannel>;

const message = (ts: string, text: string): SlackMessage =>
  ({
    ts,
    threadTs: '1723456789.123456',
    userId: 'U1',
    botId: null,
    text,
    subtype: null,
    replyCount: 1,
    replyUserCount: 1,
    postedAt: null,
    latestReplyAt: null,
    reactions: [],
  }) as SlackMessage;

describe('hydrateSlackThreadTask', () => {
  it('rebuilds the identifier and title from the fetched root message', () => {
    expect(
      hydrateSlackThreadTask({
        channelId: 'C024BE7LR',
        threadTs: '1723456789.123456',
        channels: CHANNELS,
        messages: [
          message('1723456789.123456', 'billing webhook fails on retry and nobody noticed'),
          message('1723456999.000100', 'looking'),
        ],
      }),
    ).toEqual({
      identifier: '#eng-alerts › billing webhook fails on retry a…',
      title: 'billing webhook fails on retry a…',
    });
  });

  it('keeps the channel id when the channel is not in the member list', () => {
    expect(
      hydrateSlackThreadTask({
        channelId: 'C999',
        threadTs: '1723456789.123456',
        channels: CHANNELS,
        messages: [message('1723456789.123456', 'deploy is stuck')],
      })?.identifier,
    ).toBe('#C999 › deploy is stuck');
  });

  it('refuses to hydrate a thread that came back with no messages', () => {
    expect(
      hydrateSlackThreadTask({
        channelId: 'C024BE7LR',
        threadTs: '1723456789.123456',
        channels: CHANNELS,
        messages: [],
      }),
    ).toBeNull();
  });
});

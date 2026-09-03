import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { SlackChannel, SlackMessage } from '../../integrations/slack/client';
import type { SlackThreadGroup } from '../../integrations/slack/SlackStudio/useSlackThreads';
import { adaptSlackThreads } from './slack';

const channel = (overrides: Partial<SlackChannel> = {}): SlackChannel => ({
  id: 'C1',
  name: 'eng-alerts',
  isMember: true,
  topic: null,
  memberCount: 5,
  ...overrides,
});

const head = (overrides: Partial<SlackMessage> = {}): SlackMessage => ({
  ts: '1723456789.000100',
  threadTs: '1723456789.000100',
  userId: 'U1',
  botId: null,
  text: 'the billing webhook is failing',
  subtype: null,
  replyCount: 3,
  replyUserCount: 2,
  postedAt: '2026-08-01T09:00:00Z' as IsoDateTime,
  latestReplyAt: '2026-08-01T10:00:00Z' as IsoDateTime,
  reactions: [],
  ...overrides,
});

describe('adaptSlackThreads', () => {
  it('maps a thread row into a normalized inbox record', () => {
    const sessionId = 'session-1' as SessionId;
    const groups: ReadonlyArray<SlackThreadGroup> = [
      { key: 'C1', label: '#eng-alerts', rows: [{ channel: channel(), head: head(), sessionId }] },
    ];

    const [record] = adaptSlackThreads({ groups });

    expect(record).toEqual({
      key: 'slack:thread:C1:1723456789.000100',
      provider: 'slack',
      kind: 'thread',
      identifier: '#eng-alerts',
      title: 'the billing webhook is failing',
      state: 'active',
      updatedAt: '2026-08-01T10:00:00Z',
      url: '',
      meta: '3 replies',
      payload: { provider: 'slack', kind: 'thread', channel: channel(), head: head(), sessionId },
    });
  });

  it('falls back to the ts and posted time when there is no thread reply yet', () => {
    const groups: ReadonlyArray<SlackThreadGroup> = [
      {
        key: 'C1',
        label: '#eng-alerts',
        rows: [
          {
            channel: channel(),
            head: head({ threadTs: null, latestReplyAt: null }),
            sessionId: null,
          },
        ],
      },
    ];

    const [record] = adaptSlackThreads({ groups });

    expect(record?.key).toBe('slack:thread:C1:1723456789.000100');
    expect(record?.updatedAt).toBe('2026-08-01T09:00:00Z');
  });
});

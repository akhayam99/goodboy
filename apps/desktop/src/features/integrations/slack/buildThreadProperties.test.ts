import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { resolveFacts, slackThreadFields } from '../../../shared/detail-fields';
import { buildThreadProperties } from './buildThreadProperties';
import type { SlackMessage } from './client';

const message = (ts: string, userId: string): SlackMessage =>
  ({
    ts,
    userId,
    text: 'retry the ledger job',
    postedAt: '2026-09-20T10:00:00.000Z' as IsoDateTime,
  }) as unknown as SlackMessage;

const userNames = new Map([
  ['U01', 'Mara Lin'],
  ['U02', 'Robin Vale'],
]);

const threadFactOf = (selfUserId: string | null, last: string) =>
  resolveFacts({
    registry: slackThreadFields,
    entity: buildThreadProperties({
      channelName: 'payments-api',
      messages: [message('1.0', 'U02'), message('2.0', last)],
      userNames,
      selfUserId,
    }),
  }).find((fact) => fact.key === 'thread');

describe('buildThreadProperties', () => {
  it('reads the thread as answered when the last message is yours', () => {
    const properties = buildThreadProperties({
      channelName: 'payments-api',
      messages: [message('1.0', 'U02'), message('2.0', 'U01')],
      userNames,
      selfUserId: 'U01',
    });

    expect(properties.isAnswered).toBe(true);
    expect(threadFactOf('U01', 'U01')?.label).toBe('Thread');
  });

  it('reads the thread as open when someone else spoke last', () => {
    expect(
      buildThreadProperties({
        channelName: 'payments-api',
        messages: [message('1.0', 'U01'), message('2.0', 'U02')],
        userNames,
        selfUserId: 'U01',
      }).isAnswered,
    ).toBe(false);
  });

  it('shows no thread state when it does not know who you are', () => {
    expect(threadFactOf(null, 'U01')).toBeUndefined();
  });
});

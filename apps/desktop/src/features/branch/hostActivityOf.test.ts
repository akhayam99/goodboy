import { describe, expect, it } from 'vitest';
import type { ConversationThread } from '../../shared/components/Conversation/types';
import { hostActivityOf } from './hostActivityOf';

type ThreadParams = {
  readonly id: string;
  readonly login: string;
  readonly at: string;
  readonly body: string;
};

const threadOf = ({ id, login, at, body }: ThreadParams): ConversationThread => ({
  id,
  head: {
    id,
    author: { name: login, avatarUrl: `https://avatars.example/${login}.png`, handle: login },
    createdAt: at,
    body,
    status: 'sent',
  },
  replies: [],
  anchor: null,
  isResolved: null,
});

const OPENED = {
  who: 'ada',
  avatarUrl: 'https://avatars.example/ada.png',
  at: '2026-09-01T09:00:00Z',
  isDraft: false,
};

describe('hostActivityOf', () => {
  it('orders opened, people comments and the end by time and gives each row a face', () => {
    const items = hostActivityOf({
      opened: OPENED,
      threads: [
        threadOf({ id: 'b', login: 'grace', at: '2026-09-02T09:00:00Z', body: 'Looks right' }),
      ],
      end: { kind: 'merged', at: '2026-09-03T09:00:00Z', who: 'ada', avatarUrl: null },
    });

    expect(items.map((item) => item.kind)).toEqual(['opened', 'review', 'merged']);
    expect(items[1]).toMatchObject({
      who: 'grace',
      avatarUrl: 'https://avatars.example/grace.png',
      text: '',
    });
  });

  it('folds every comment of one bot into one row with its notes', () => {
    const items = hostActivityOf({
      opened: OPENED,
      threads: [
        threadOf({
          id: 'a',
          login: 'acme-review[bot]',
          at: '2026-09-01T10:00:00Z',
          body: 'Nit one',
        }),
        threadOf({ id: 'b', login: 'grace', at: '2026-09-01T11:00:00Z', body: 'Thanks' }),
        threadOf({
          id: 'c',
          login: 'acme-review[bot]',
          at: '2026-09-01T12:00:00Z',
          body: 'Nit two',
        }),
      ],
      end: null,
    });

    expect(items.map((item) => item.kind)).toEqual(['opened', 'review', 'bot']);
    expect(items[2]).toMatchObject({ kind: 'bot', count: 2, notes: ['Nit one', 'Nit two'] });
  });

  it('hides the opened row when the host has no creation time and the end row when it is open', () => {
    const items = hostActivityOf({
      opened: { ...OPENED, at: null },
      threads: [],
      end: null,
    });

    expect(items).toEqual([]);
  });

  it('shows a closed row without a person', () => {
    const items = hostActivityOf({
      opened: OPENED,
      threads: [],
      end: { kind: 'closed', at: '2026-09-02T09:00:00Z', who: null, avatarUrl: null },
    });

    expect(items.map((item) => item.kind)).toEqual(['opened', 'closed']);
  });
});

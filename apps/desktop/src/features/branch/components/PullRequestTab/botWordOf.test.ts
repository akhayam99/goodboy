import { describe, expect, it } from 'vitest';
import type { PrComment, PullRequestReviewer } from '@goodboy/types';
import type { ThreadEntry } from '../../../resolve/commentGroupsView';
import { botWordOf } from './botWordOf';

const BOT: PullRequestReviewer = {
  person: { login: 'cascadia-lint', name: null, avatarUrl: null, isBot: true },
  state: 'commented',
};

type CommentParams = {
  readonly id: string;
  readonly author: string;
  readonly isResolved?: boolean;
  readonly replyTo?: string;
  readonly source?: PrComment['source'];
};

const comment = ({
  id,
  author,
  isResolved = false,
  replyTo,
  source = 'review',
}: CommentParams): PrComment => ({
  id,
  author,
  authorAvatarUrl: null,
  body: 'Retry cap check misses the 429 path',
  createdAt: '2026-11-07T10:00:00Z',
  url: `https://github.com/northwind/payments-api/pull/318#${id}`,
  source,
  resolved: isResolved,
  threadId: `thread-${id}`,
  ...(replyTo === undefined ? {} : { inReplyToId: replyTo }),
});

describe('botWordOf', () => {
  it('counts the open threads a bot started as its issues', () => {
    const comments = [
      comment({ id: 'a', author: 'cascadia-lint' }),
      comment({ id: 'b', author: 'cascadia-lint[bot]' }),
      comment({ id: 'c', author: 'nadia-p', replyTo: 'a' }),
      comment({ id: 'd', author: 'cascadia-lint', isResolved: true }),
      comment({ id: 'e', author: 'omar-t' }),
    ];

    expect(botWordOf({ bot: BOT, comments, entries: [] })).toEqual({
      word: '2 issues',
      tone: 'warning',
    });
  });

  it('counts a thread of the bot left open on the host as one of its issues', () => {
    const comments = [comment({ id: 'a', author: 'cascadia-lint', isResolved: true })];
    const entries: ReadonlyArray<ThreadEntry> = [
      {
        threadId: 'thread-a',
        resolveWord: 'left_open',
        row: {
          thread: {
            stage: 'parked',
            state: 'open',
            stateReason: null,
            originKind: 'review_comment',
          },
        },
      },
    ];

    expect(botWordOf({ bot: BOT, comments, entries })).toEqual({
      word: '1 issue',
      tone: 'warning',
    });
  });

  it('counts only the queued threads of the bot once the queue has loaded', () => {
    const comments = [
      comment({ id: 'a', author: 'cascadia-lint' }),
      comment({ id: 'b', author: 'cascadia-lint', isResolved: true }),
    ];
    const entries: ReadonlyArray<ThreadEntry> = [
      {
        threadId: 'thread-b',
        resolveWord: 'done',
        row: {
          thread: {
            stage: 'resolved',
            state: 'closed',
            stateReason: null,
            originKind: 'review_comment',
          },
        },
      },
    ];

    expect(botWordOf({ bot: BOT, comments, entries })).toEqual({
      word: '1 resolved',
      tone: 'neutral',
    });
  });

  it('says how many it raised once all of them are resolved', () => {
    const comments = [comment({ id: 'a', author: 'cascadia-lint', isResolved: true })];

    expect(botWordOf({ bot: BOT, comments, entries: [] })).toEqual({
      word: '1 resolved',
      tone: 'neutral',
    });
  });

  it('falls back to the review state when it left no thread or the comments are not read', () => {
    const summary = [comment({ id: 'a', author: 'cascadia-lint', source: 'issue' })];

    expect(botWordOf({ bot: BOT, comments: summary, entries: [] }).word).toBe('Commented');
    expect(
      botWordOf({ bot: { ...BOT, state: 'approved' }, comments: null, entries: [] }).word,
    ).toBe('Approved');
  });
});

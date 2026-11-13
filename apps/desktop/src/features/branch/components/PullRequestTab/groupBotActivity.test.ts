import { describe, expect, it } from 'vitest';
import type { PrComment } from '@goodboy/types';
import type { ActivityItem } from '../../../../shared/components/PullRequestActivity/activityItem';
import { groupBotActivity } from './groupBotActivity';

type ReviewParams = {
  readonly who: string;
  readonly at: string;
  readonly verdict?: 'approved' | 'changes_requested' | 'commented';
  readonly isBot?: boolean;
  readonly text?: string;
};

const review = ({
  who,
  at,
  verdict = 'commented',
  isBot,
  text = `${who} says hi`,
}: ReviewParams): ActivityItem => ({
  kind: 'review',
  key: `review:${who}:${at}`,
  at,
  who,
  verdict,
  text,
  ...(isBot === undefined ? {} : { isBot }),
});

type FindingParams = {
  readonly id: string;
  readonly author: string;
  readonly isResolved: boolean;
};

const finding = ({ id, author, isResolved }: FindingParams): PrComment => ({
  id,
  author,
  authorAvatarUrl: null,
  body: 'Retry cap check misses the 429 path',
  createdAt: '2026-10-01T10:00:00Z',
  url: `https://github.com/harborline/payments-api/pull/318#discussion_${id}`,
  source: 'review',
  threadId: `PRT_${id}`,
  resolved: isResolved,
});

type KindsParams = {
  readonly items: ReadonlyArray<ActivityItem>;
};

const kindsOf = ({ items }: KindsParams) =>
  items.map((item) => (item.kind === 'bot' ? `bot:${item.who}` : item.kind));

describe('groupBotActivity', () => {
  it('folds the findings of one bot into one row, wherever its reviews sit', () => {
    const grouped = groupBotActivity({
      items: [
        review({ who: 'cascadia-lint[bot]', at: '2026-10-01T10:00:00Z' }),
        review({ who: 'dana-r', at: '2026-10-01T10:01:00Z', verdict: 'approved' }),
        review({ who: 'cascadia-lint[bot]', at: '2026-10-01T10:02:00Z', text: 'Second pass' }),
      ],
      comments: null,
      entries: [],
    });

    expect(kindsOf({ items: grouped })).toEqual(['review', 'bot:cascadia-lint[bot]']);
    expect(grouped[1]).toMatchObject({
      at: '2026-10-01T10:02:00Z',
      notes: ['cascadia-lint[bot] says hi', 'Second pass'],
    });
  });

  it('keeps one row per bot', () => {
    const grouped = groupBotActivity({
      items: [
        review({ who: 'portal-preview[bot]', at: '2026-10-01T10:00:00Z' }),
        review({ who: 'size-watch[bot]', at: '2026-10-01T10:01:00Z' }),
        review({ who: 'portal-preview[bot]', at: '2026-10-01T10:02:00Z' }),
      ],
      comments: null,
      entries: [],
    });

    expect(kindsOf({ items: grouped })).toEqual(['bot:size-watch[bot]', 'bot:portal-preview[bot]']);
  });

  it('reads a bot by its author type when the login has no suffix', () => {
    const grouped = groupBotActivity({
      items: [review({ who: 'acme-review', at: '2026-10-01T10:00:00Z', isBot: true })],
      comments: null,
      entries: [],
    });

    expect(kindsOf({ items: grouped })).toEqual(['bot:acme-review']);
  });

  it('keeps a person without a suffix as a person when the type says so', () => {
    const grouped = groupBotActivity({
      items: [review({ who: 'acme-review', at: '2026-10-01T10:00:00Z', isBot: false })],
      comments: null,
      entries: [],
    });

    expect(kindsOf({ items: grouped })).toEqual(['review']);
  });

  it('keeps a person whose login ends in bot as a person when the type says so', () => {
    const grouped = groupBotActivity({
      items: [review({ who: 'acme-bot', at: '2026-10-01T10:00:00Z', isBot: false })],
      comments: null,
      entries: [],
    });

    expect(kindsOf({ items: grouped })).toEqual(['review']);
  });

  it('falls back to the login suffix when the type is unknown', () => {
    const grouped = groupBotActivity({
      items: [review({ who: 'size-watch[bot]', at: '2026-10-01T10:00:00Z' })],
      comments: null,
      entries: [],
    });

    expect(kindsOf({ items: grouped })).toEqual(['bot:size-watch[bot]']);
  });

  it('gives each bot its one-word verdict from its open threads', () => {
    const grouped = groupBotActivity({
      items: [review({ who: 'cascadia-lint[bot]', at: '2026-10-01T10:00:00Z' })],
      comments: [
        finding({ id: '1', author: 'cascadia-lint[bot]', isResolved: false }),
        finding({ id: '2', author: 'cascadia-lint[bot]', isResolved: false }),
      ],
      entries: [],
    });

    expect(grouped[0]).toMatchObject({ kind: 'bot', word: '2 issues', tone: 'warning' });
  });

  it('says resolved once every finding of the bot is resolved', () => {
    const grouped = groupBotActivity({
      items: [review({ who: 'cascadia-lint[bot]', at: '2026-10-01T10:00:00Z' })],
      comments: [finding({ id: '1', author: 'cascadia-lint[bot]', isResolved: true })],
      entries: [],
    });

    expect(grouped[0]).toMatchObject({ kind: 'bot', word: '1 resolved', tone: 'neutral' });
  });

  it('keeps a bot verdict as its own review', () => {
    expect(
      kindsOf({
        items: groupBotActivity({
          items: [
            review({ who: 'release-gate[bot]', at: '2026-10-01T10:00:00Z', verdict: 'approved' }),
          ],
          comments: null,
          entries: [],
        }),
      }),
    ).toEqual(['review']);
  });
});

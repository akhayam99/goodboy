import { describe, expect, it } from 'vitest';
import type { ActivityItem } from './activityOf';
import { groupBotActivity } from './groupBotActivity';

type ReviewParams = {
  readonly who: string;
  readonly at: string;
  readonly verdict?: 'approved' | 'changes_requested' | 'commented';
};

const review = ({ who, at, verdict = 'commented' }: ReviewParams): ActivityItem => ({
  kind: 'review',
  key: `review:${who}:${at}`,
  at,
  who,
  verdict,
  text: `${who} says hi`,
});

type KindsParams = {
  readonly items: ReadonlyArray<ActivityItem>;
};

const kindsOf = ({ items }: KindsParams) =>
  items.map((item) => (item.kind === 'bots' ? `bots:${item.comments.length}` : item.kind));

describe('groupBotActivity', () => {
  it('folds consecutive bot comments into one event', () => {
    const grouped = groupBotActivity({
      items: [
        review({ who: 'portal-preview[bot]', at: '2026-10-01T10:00:00Z' }),
        review({ who: 'size-watch[bot]', at: '2026-10-01T10:01:00Z' }),
        review({ who: 'coverage-scout[bot]', at: '2026-10-01T10:02:00Z' }),
      ],
    });

    expect(kindsOf({ items: grouped })).toEqual(['bots:3']);
    expect(grouped[0]?.at).toBe('2026-10-01T10:02:00Z');
  });

  it('splits the group when a person comments in between', () => {
    const grouped = groupBotActivity({
      items: [
        review({ who: 'portal-preview[bot]', at: '2026-10-01T10:00:00Z' }),
        review({ who: 'dana-r', at: '2026-10-01T10:01:00Z', verdict: 'approved' }),
        review({ who: 'size-watch[bot]', at: '2026-10-01T10:02:00Z' }),
        review({ who: 'coverage-scout[bot]', at: '2026-10-01T10:03:00Z' }),
      ],
    });

    expect(kindsOf({ items: grouped })).toEqual(['bots:1', 'review', 'bots:2']);
  });

  it('keeps a bot verdict as its own review', () => {
    expect(
      kindsOf({
        items: groupBotActivity({
          items: [
            review({ who: 'release-gate[bot]', at: '2026-10-01T10:00:00Z', verdict: 'approved' }),
          ],
        }),
      }),
    ).toEqual(['review']);
  });
});

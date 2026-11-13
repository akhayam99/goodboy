import { describe, expect, it } from 'vitest';
import type { ActivityItem } from './activityItem';
import { foldPushes } from './foldPushes';
import { pushLineOf } from './pushLineOf';

const push = ({
  key,
  who,
  count,
}: {
  readonly key: string;
  readonly who: string;
  readonly count: number;
}): ActivityItem => ({
  kind: 'push',
  key,
  at: '2026-10-01T10:00:00Z',
  who,
  count,
  pushes: 1,
  sha: 'a41c9e2',
});

describe('pushLineOf', () => {
  it('says the commits alone for one push', () => {
    const [item] = foldPushes({ items: [push({ key: 'a', who: 'nadia-p', count: 1 })] });

    expect(item?.kind === 'push' ? pushLineOf({ item }) : '').toBe('pushed 1 commit');
  });

  it('folds the pushes of one person in a row into one line with both counts', () => {
    const folded = foldPushes({
      items: [
        push({ key: 'a', who: 'nadia-p', count: 3 }),
        push({ key: 'b', who: 'nadia-p', count: 2 }),
        push({ key: 'c', who: 'omar-t', count: 1 }),
      ],
    });
    const [first] = folded;

    expect(folded).toHaveLength(2);
    expect(first?.kind === 'push' ? pushLineOf({ item: first }) : '').toBe(
      'pushed 5 commits in 2 pushes',
    );
  });
});

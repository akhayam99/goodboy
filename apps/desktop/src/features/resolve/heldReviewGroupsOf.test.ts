// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ResolveGroup } from './commentProjection';
import { heldReviewGroupsOf, type HeldReviewPlaces } from './heldReviewGroupsOf';

type Group = {
  readonly group: ResolveGroup;
  readonly entries: ReadonlyArray<{ readonly threadId: string }>;
};

type GroupParams = {
  readonly group: ResolveGroup;
  readonly threadIds: ReadonlyArray<string>;
};

const groupOf = ({ group, threadIds }: GroupParams): Group => ({
  group,
  entries: threadIds.map((threadId) => ({ threadId })),
});

type ShapeParams = {
  readonly groups: ReadonlyArray<Group>;
};

const shapeOf = ({ groups }: ShapeParams) =>
  groups.map(({ group, entries }) => [group, entries.map((entry) => entry.threadId)]);

const NONE: HeldReviewPlaces = new Map();

describe('heldReviewGroupsOf', () => {
  it('keeps a comment in the group and the place it had when the tab opened', () => {
    const first = heldReviewGroupsOf({
      held: NONE,
      groups: [
        groupOf({ group: 'needs_you', threadIds: ['config', 'metrics', 'idempotency'] }),
        groupOf({ group: 'done', threadIds: ['retry'] }),
      ],
    });
    const later = heldReviewGroupsOf({
      held: first.held,
      groups: [
        groupOf({ group: 'needs_you', threadIds: ['idempotency', 'config'] }),
        groupOf({ group: 'working', threadIds: ['metrics'] }),
        groupOf({ group: 'done', threadIds: ['retry'] }),
      ],
    });

    expect(later.held).toBe(first.held);
    expect(shapeOf(later)).toEqual([
      ['needs_you', ['config', 'metrics', 'idempotency']],
      ['done', ['retry']],
    ]);
  });

  it('puts a comment that shows up later in its own group, after the held ones', () => {
    const first = heldReviewGroupsOf({
      held: NONE,
      groups: [groupOf({ group: 'needs_you', threadIds: ['config'] })],
    });
    const later = heldReviewGroupsOf({
      held: first.held,
      groups: [
        groupOf({ group: 'needs_you', threadIds: ['metrics', 'config'] }),
        groupOf({ group: 'working', threadIds: ['retry'] }),
      ],
    });

    expect(shapeOf(later)).toEqual([
      ['needs_you', ['config', 'metrics']],
      ['working', ['retry']],
    ]);
  });

  it('starts from the live groups on a fresh visit', () => {
    const visit = heldReviewGroupsOf({
      held: NONE,
      groups: [
        groupOf({ group: 'needs_you', threadIds: ['config'] }),
        groupOf({ group: 'working', threadIds: ['metrics'] }),
      ],
    });

    expect(shapeOf(visit)).toEqual([
      ['needs_you', ['config']],
      ['working', ['metrics']],
    ]);
  });
});

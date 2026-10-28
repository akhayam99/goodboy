import { describe, expect, it } from 'vitest';
import type { ImplementationCluster } from '@goodboy/types';
import { clusterAncestors } from './clusterAncestors';
import { clusterTouchesOverlap } from './clusterTouchesOverlap';
import { concurrentClusters } from './concurrentClusters';
import { planClusterWaves } from './planClusterWaves';
import { readyClusterIndexes } from './readyClusterIndexes';

const part = (
  title: string,
  extra: Partial<ImplementationCluster> = {},
): ImplementationCluster => ({ title, instructions: `do ${title}`, ...extra });

describe('clusterTouchesOverlap', () => {
  it('overlaps on the same file', () => {
    expect(
      clusterTouchesOverlap({
        first: ['apps/web/src/routes.ts'],
        second: ['apps/web/src/routes.ts'],
      }),
    ).toBe(true);
  });

  it('overlaps when one entry is a folder holding the other', () => {
    expect(
      clusterTouchesOverlap({
        first: ['apps/web/src/domains'],
        second: ['apps/web/src/domains/paths/index.ts'],
      }),
    ).toBe(true);
    expect(
      clusterTouchesOverlap({
        first: ['apps/web/src/domains/paths/index.ts'],
        second: ['apps/web/src/domains/'],
      }),
    ).toBe(true);
  });

  it('does not treat a shared name prefix as a folder prefix', () => {
    expect(
      clusterTouchesOverlap({
        first: ['apps/web/src/domain'],
        second: ['apps/web/src/domains/paths'],
      }),
    ).toBe(false);
  });

  it('is disjoint for different files and folders', () => {
    expect(
      clusterTouchesOverlap({
        first: ['packages/ledger-core/src', 'docs/ledger.md'],
        second: ['packages/notify-relay/src'],
      }),
    ).toBe(false);
  });

  it('treats a part with no touches as touching everything', () => {
    expect(clusterTouchesOverlap({ first: undefined, second: ['docs/a.md'] })).toBe(true);
    expect(clusterTouchesOverlap({ first: [], second: ['docs/a.md'] })).toBe(true);
    expect(clusterTouchesOverlap({ first: ['docs/a.md'], second: [] })).toBe(true);
  });

  it('ignores leading dots, slashes and backslashes', () => {
    expect(clusterTouchesOverlap({ first: ['./docs/a.md'], second: ['docs\\a.md'] })).toBe(true);
  });
});

describe('planClusterWaves', () => {
  it('puts disjoint parts in one wave', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { touches: ['packages/ledger-core/src'] }),
        part('B', { touches: ['packages/notify-relay/src'] }),
        part('C', { touches: ['packages/payments-api/src'] }),
      ],
    });
    expect(plan.waves).toEqual([[0, 1, 2]]);
    expect(plan.blockers).toEqual([[], [], []]);
    expect(plan.shared).toEqual([]);
    expect(plan.issue).toBeNull();
  });

  it('orders two parts that touch the same file by plan order', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { touches: ['src/routes.ts', 'src/a.ts'] }),
        part('B', { touches: ['src/routes.ts', 'src/b.ts'] }),
      ],
    });
    expect(plan.waves).toEqual([[0], [1]]);
    expect(plan.blockers).toEqual([[], [0]]);
    expect(plan.shared).toEqual([{ path: 'src/routes.ts', parts: [0, 1] }]);
  });

  it('orders a folder owner before a part editing a file inside it', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { touches: ['src/domains'] }),
        part('B', { touches: ['src/domains/paths/index.ts'] }),
        part('C', { touches: ['docs/paths.md'] }),
      ],
    });
    expect(plan.waves).toEqual([[0, 2], [1]]);
    expect(plan.shared).toEqual([{ path: 'src/domains/paths/index.ts', parts: [0, 1] }]);
  });

  it('runs a part with no touches alone, in plan order', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { touches: ['docs/a.md'] }),
        part('B'),
        part('C', { touches: ['docs/c.md'] }),
      ],
    });
    expect(plan.waves).toEqual([[0], [1], [2]]);
    expect(plan.soloIndexes).toEqual([1]);
  });

  it('chains three parts that overlap pairwise', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { touches: ['src/routes.ts'] }),
        part('B', { touches: ['src/routes.ts', 'next.config.ts'] }),
        part('C', { touches: ['next.config.ts'] }),
      ],
    });
    expect(plan.waves).toEqual([[0], [1], [2]]);
    expect(plan.blockers).toEqual([[], [0], [1]]);
  });

  it('chains three parts that all touch one file', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { touches: ['src/routes.ts'] }),
        part('B', { touches: ['src/routes.ts'] }),
        part('C', { touches: ['src/routes.ts'] }),
      ],
    });
    expect(plan.waves).toEqual([[0], [1], [2]]);
    expect(plan.shared).toEqual([{ path: 'src/routes.ts', parts: [0, 1, 2] }]);
  });

  it('keeps independent parts that depend only on a shared first part in one wave', () => {
    const plan = planClusterWaves({
      clusters: [
        part('Shared', { id: 'shared', touches: ['src/routes.ts', 'next.config.ts'] }),
        part('A', { id: 'a', after: ['shared'], touches: ['src/a'] }),
        part('B', { id: 'b', after: ['shared'], touches: ['src/b'] }),
      ],
    });
    expect(plan.ids).toEqual(['shared', 'a', 'b']);
    expect(plan.waves).toEqual([[0], [1, 2]]);
    expect(plan.blockers).toEqual([[], [0], [0]]);
    expect(plan.issue).toBeNull();
  });

  it('lets a declared order win over plan order for overlapping parts', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { id: 'a', after: ['b'], touches: ['src/routes.ts'] }),
        part('B', { id: 'b', touches: ['src/routes.ts'] }),
      ],
    });
    expect(plan.waves).toEqual([[1], [0]]);
    expect(plan.shared).toEqual([{ path: 'src/routes.ts', parts: [1, 0] }]);
  });

  it('derives ids from order when the plan has none', () => {
    const plan = planClusterWaves({ clusters: [part('A'), part('B')] });
    expect(plan.ids).toEqual(['part-1', 'part-2']);
  });

  it('falls back to computed waves when after names an unknown id', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { id: 'a', touches: ['src/a'] }),
        part('B', { id: 'b', after: ['ghost'], touches: ['src/b'] }),
      ],
    });
    expect(plan.issue).toBe('unknown-id');
    expect(plan.waves).toEqual([[0, 1]]);
  });

  it('falls back to computed waves when a part is after itself', () => {
    const plan = planClusterWaves({
      clusters: [part('A', { id: 'a', after: ['a'], touches: ['src/a'] }), part('B')],
    });
    expect(plan.issue).toBe('self-reference');
  });

  it('falls back to computed waves on a cycle', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { id: 'a', after: ['b'], touches: ['src/a'] }),
        part('B', { id: 'b', after: ['a'], touches: ['src/b'] }),
      ],
    });
    expect(plan.issue).toBe('cycle');
    expect(plan.waves).toEqual([[0, 1]]);
  });

  it('falls back when ids repeat and after is used', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { id: 'x', touches: ['src/a'] }),
        part('B', { id: 'x', after: ['x'], touches: ['src/b'] }),
      ],
    });
    expect(plan.issue).toBe('duplicate-id');
    expect(plan.ids).toEqual(['part-1', 'part-2']);
  });

  it('reports no issue for repeated ids when nothing uses after', () => {
    const plan = planClusterWaves({
      clusters: [part('A', { id: 'x' }), part('B', { id: 'x' })],
    });
    expect(plan.issue).toBeNull();
  });

  it('never makes a cycle out of overlap edges and declared order', () => {
    const plan = planClusterWaves({
      clusters: [
        part('A', { id: 'a', after: ['c'], touches: ['src/x', 'src/y'] }),
        part('B', { id: 'b', touches: ['src/x', 'src/z'] }),
        part('C', { id: 'c', touches: ['src/z', 'src/y'] }),
      ],
    });
    expect(plan.waves.flat().sort()).toEqual([0, 1, 2]);
    expect(plan.waves).toEqual([[2], [0], [1]]);
  });
});

describe('clusterAncestors and concurrentClusters', () => {
  const plan = planClusterWaves({
    clusters: [
      part('Shared', { id: 'shared', touches: ['src/routes.ts'] }),
      part('A', { id: 'a', after: ['shared'], touches: ['src/a'] }),
      part('B', { id: 'b', after: ['shared'], touches: ['src/b'] }),
      part('C', { id: 'c', after: ['b'], touches: ['src/c'] }),
    ],
  });

  it('lists every part that finishes before a part, nearest or not', () => {
    expect(clusterAncestors({ plan, index: 3 })).toEqual([0, 2]);
    expect(clusterAncestors({ plan, index: 0 })).toEqual([]);
  });

  it('lists the parts that can run at the same time', () => {
    expect(concurrentClusters({ plan, index: 1 })).toEqual([2, 3]);
    expect(concurrentClusters({ plan, index: 3 })).toEqual([1]);
    expect(concurrentClusters({ plan, index: 0 })).toEqual([]);
  });
});

describe('readyClusterIndexes', () => {
  const plan = planClusterWaves({
    clusters: [
      part('Shared', { touches: ['src/routes.ts'] }),
      part('A', { after: undefined, touches: ['src/routes.ts', 'src/a'] }),
      part('B', { touches: ['src/b'] }),
    ],
  });

  it('starts every part without a blocker', () => {
    expect(
      readyClusterIndexes({ plan, doneIndexes: new Set(), startedIndexes: new Set() }),
    ).toEqual([0, 2]);
  });

  it('holds a part until its blockers are done', () => {
    expect(
      readyClusterIndexes({ plan, doneIndexes: new Set(), startedIndexes: new Set([0, 2]) }),
    ).toEqual([]);
    expect(
      readyClusterIndexes({
        plan,
        doneIndexes: new Set([0]),
        startedIndexes: new Set([0, 2]),
      }),
    ).toEqual([1]);
  });
});

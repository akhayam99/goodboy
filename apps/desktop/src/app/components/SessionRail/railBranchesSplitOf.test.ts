import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProjectId } from '@goodboy/types';
import type { MountRowView } from '../../../store/slices/project-mounts/mountRowModel';
import { railBranchesSplitOf, type RailBranchEntry } from './railBranchesSplitOf';

type EntryParams = {
  readonly id: string;
  readonly tone?: 'danger' | 'warning' | null;
  readonly isShown?: boolean;
};

const rowOf = ({ id }: { readonly id: string }): MountRowView => ({
  mountId: brandId<MountId>({ value: id }),
  projectId: brandId<ProjectId>({ value: 'project-payments-api' }),
  projectName: 'payments-api',
  projectKind: 'repo',
  mountName: 'payments-api',
  branch: `hl/${id}`,
  baseBranch: 'main',
  worktreePath: `/w/payments-api-${id}`,
  lastWorktreePath: null,
  repoRoot: '/w/payments-api',
  isAttached: true,
  isMainCheckout: false,
  isOnDisk: true,
  revision: 1,
  parallelIndex: 0,
  request: null,
  series: null,
  observation: null,
  observedBranchHolder: null,
  isFinished: false,
});

const entryOf = ({ id, tone = null, isShown = false }: EntryParams): RailBranchEntry => ({
  row: rowOf({ id }),
  state: { tone, reason: null },
  isShown,
});

const idsOf = (entries: ReadonlyArray<RailBranchEntry>): ReadonlyArray<string> =>
  entries.map((entry) => entry.row.mountId);

describe('the folded rail branch split', () => {
  it('gives a glyph to a branch with a dot and to the shown branch, and folds the rest', () => {
    const split = railBranchesSplitOf({
      entries: [
        entryOf({ id: 'a' }),
        entryOf({ id: 'b', tone: 'warning' }),
        entryOf({ id: 'c', isShown: true }),
        entryOf({ id: 'd' }),
        entryOf({ id: 'e' }),
      ],
    });

    expect(idsOf(split.own)).toEqual(['b', 'c']);
    expect(idsOf(split.folded)).toEqual(['a', 'd', 'e']);
  });

  it('keeps a single quiet branch as its own glyph', () => {
    const split = railBranchesSplitOf({
      entries: [entryOf({ id: 'a', tone: 'danger' }), entryOf({ id: 'b' })],
    });

    expect(idsOf(split.own)).toEqual(['a', 'b']);
    expect(split.folded).toEqual([]);
  });

  it('folds two quiet branches into the button', () => {
    const split = railBranchesSplitOf({ entries: [entryOf({ id: 'a' }), entryOf({ id: 'b' })] });

    expect(split.own).toEqual([]);
    expect(idsOf(split.folded)).toEqual(['a', 'b']);
  });
});

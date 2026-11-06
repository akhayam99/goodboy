// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountBranchObservation,
  type MountBranchObservationState,
  type MountId,
  type SessionId,
  type WorktreeStatus,
} from '@goodboy/types';

import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { worktreeStatusOf } from '../../../../test/worktreeStatusOf';
import { aMountRow } from '../../central/branches/testing/aMountRow';
import { mismatchDismissalKeyOf } from './mismatchDismissalKeyOf';
import { overviewNoticesOf } from './overviewNoticesOf';

type ObservationParams = {
  readonly key: string;
  readonly state: MountBranchObservationState;
};

const observationOf = ({ key, state }: ObservationParams): MountBranchObservation => ({
  mountId: brandId<MountId>({ value: `mount-${key}` }),
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  state,
  recordedBranch: 'fix/ledger-reconciliation',
  observedBranch: state === 'mismatch' ? 'fix/ledger-retry-budget' : 'fix/ledger-reconciliation',
  revision: 1,
  observedAt: brandId<IsoDateTime>({ value: '2026-11-06T09:00:00.000Z' }),
});

type RowParams = {
  readonly key: string;
  readonly isAttached?: boolean;
  readonly state?: MountBranchObservationState | null;
};

const rowOf = ({ key, isAttached = true, state = null }: RowParams): MountRowView => ({
  ...aMountRow({ key, projectName: 'ledger-core', branch: 'fix/ledger-reconciliation' }),
  isAttached,
  observation: state === null ? null : observationOf({ key, state }),
});

const NO_MOUNTS: ReadonlySet<string> = new Set();

const noStatus = () => null;

const rebasing = (): WorktreeStatus => worktreeStatusOf({ inProgress: 'rebase' });

describe('overviewNoticesOf', () => {
  it('counts a mismatch and a stranded branch, one each, and a closed branch not at all', () => {
    const rows = [
      rowOf({ key: 'closed', isAttached: false }),
      rowOf({ key: 'mismatch', state: 'mismatch' }),
      rowOf({ key: 'foreign' }),
    ];

    expect(
      overviewNoticesOf({
        rows,
        statusOf: noStatus,
        foreignMountIds: new Set(['mount-foreign']),
        dismissedKeys: NO_MOUNTS,
        isPublishShown: false,
      }).map((notice) => notice.id),
    ).toEqual(['mismatch:mount-mismatch', 'foreign:mount-foreign']);
  });

  it('counts the publish notice of a first lap project', () => {
    expect(
      overviewNoticesOf({
        rows: [],
        statusOf: noStatus,
        foreignMountIds: NO_MOUNTS,
        dismissedKeys: NO_MOUNTS,
        isPublishShown: true,
      }),
    ).toEqual([{ id: 'publish', kind: 'publish' }]);
  });

  it('counts nothing for a matched branch or a mismatch you dismissed', () => {
    const later = rowOf({ key: 'later', state: 'mismatch' });
    expect(
      overviewNoticesOf({
        rows: [rowOf({ key: 'matched', state: 'matched' }), later],
        statusOf: noStatus,
        foreignMountIds: NO_MOUNTS,
        dismissedKeys: new Set([
          mismatchDismissalKeyOf({
            observation: observationOf({ key: 'later', state: 'mismatch' }),
          }),
        ]),
        isPublishShown: false,
      }),
    ).toEqual([]);
  });

  it('counts a new mismatch of a branch whose earlier mismatch you dismissed', () => {
    const moved: MountRowView = {
      ...rowOf({ key: 'later', state: 'mismatch' }),
      observation: {
        ...observationOf({ key: 'later', state: 'mismatch' }),
        observedBranch: 'fix/ledger-another-branch',
      },
    };
    expect(
      overviewNoticesOf({
        rows: [moved],
        statusOf: noStatus,
        foreignMountIds: NO_MOUNTS,
        dismissedKeys: new Set([
          mismatchDismissalKeyOf({
            observation: observationOf({ key: 'later', state: 'mismatch' }),
          }),
        ]),
        isPublishShown: false,
      }).map((notice) => notice.id),
    ).toEqual(['mismatch:mount-later']);
  });

  it('draws only the stopped rebase for a worktree that is rebasing', () => {
    expect(
      overviewNoticesOf({
        rows: [rowOf({ key: 'busy', state: 'mismatch' })],
        statusOf: rebasing,
        foreignMountIds: new Set(['mount-busy']),
        dismissedKeys: NO_MOUNTS,
        isPublishShown: false,
      }),
    ).toEqual([]);
  });
});

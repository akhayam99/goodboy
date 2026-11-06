// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountBranchObservation,
  type MountId,
  type SessionId,
} from '@goodboy/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { aMountRow } from '../../central/branches/testing/aMountRow';
import { liveDismissalsOf } from './liveDismissalsOf';
import { mismatchDismissalKeyOf } from './mismatchDismissalKeyOf';

const OBSERVATION: MountBranchObservation = {
  mountId: brandId<MountId>({ value: 'mount-ledger' }),
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  state: 'mismatch',
  recordedBranch: 'fix/ledger-reconciliation',
  observedBranch: 'fix/ledger-retry-budget',
  revision: 1,
  observedAt: brandId<IsoDateTime>({ value: '2026-11-06T09:00:00.000Z' }),
};

const rowOf = ({
  observation,
}: {
  readonly observation: MountBranchObservation | null;
}): MountRowView => ({
  ...aMountRow({ key: 'ledger', projectName: 'ledger-core', branch: 'fix/ledger-reconciliation' }),
  observation,
});

const DISMISSED: ReadonlySet<string> = new Set([
  mismatchDismissalKeyOf({ observation: OBSERVATION }),
]);

describe('liveDismissalsOf', () => {
  it('keeps a dismissal while the same observation stays, so a repeated poll stays dismissed', () => {
    const rows = [rowOf({ observation: { ...OBSERVATION, revision: 2 } })];

    expect(liveDismissalsOf({ dismissedKeys: DISMISSED, rows })).toBe(DISMISSED);
  });

  it('expires the dismissal when the observation clears, so the same mismatch shows again', () => {
    const cleared = liveDismissalsOf({
      dismissedKeys: DISMISSED,
      rows: [rowOf({ observation: null })],
    });

    expect(cleared.has(mismatchDismissalKeyOf({ observation: OBSERVATION }))).toBe(false);
  });

  it('expires the dismissal when the row is gone', () => {
    expect(liveDismissalsOf({ dismissedKeys: DISMISSED, rows: [] }).size).toBe(0);
  });
});

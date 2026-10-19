import { describe, expect, it } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import type { RebaseAllBranch } from '../../../../store/slices/rebaseAll/types';
import { branchRowChipOf } from './branchRowChipOf';

const branchOf = ({ state }: Pick<RebaseAllBranch, 'state'>): RebaseAllBranch => ({
  mountId: brandId<MountId>({ value: 'mount-ledger-core' }),
  projectName: 'ledger-core',
  branch: 'hl/export-batch',
  state,
  message: null,
});

const BASE = {
  signal: null,
  isSettled: false,
  isRebaseStopped: false,
  isBatchSettled: false,
  progress: null,
  conflictFiles: [],
} as const;

describe('branchRowChipOf during a Rebase all', () => {
  it('says Rebasing with the git icon and a breathing mark', () => {
    expect(branchRowChipOf({ ...BASE, rebase: branchOf({ state: 'rebasing' }) })).toMatchObject({
      text: 'Rebasing',
      icon: 'git',
      isBreathing: true,
    });
  });

  it('says Auto resolving with the file when one file is left', () => {
    const chip = branchRowChipOf({
      ...BASE,
      rebase: branchOf({ state: 'auto' }),
      isRebaseStopped: true,
      conflictFiles: ['src/retry/backoff.ts'],
    });

    expect(chip).toMatchObject({
      text: 'Auto resolving',
      icon: 'auto',
      isBreathing: true,
      reason: 'Auto resolves 1 file: src/retry/backoff.ts',
    });
  });

  it('counts the files when several are left', () => {
    const chip = branchRowChipOf({
      ...BASE,
      rebase: branchOf({ state: 'auto' }),
      isRebaseStopped: true,
      conflictFiles: ['src/a.ts', 'src/b.ts'],
    });

    expect(chip?.reason).toBe('Auto resolves 2 files');
  });

  it('says Conflict while Auto has not started on it', () => {
    expect(branchRowChipOf({ ...BASE, rebase: branchOf({ state: 'auto' }) })).toMatchObject({
      text: 'Conflict',
      tone: 'danger',
      reason: 'Waiting for Auto',
      isBreathing: false,
    });
  });

  it('says Rebased by Auto until the batch settles, then nothing', () => {
    const rebase = branchOf({ state: 'auto' });

    expect(branchRowChipOf({ ...BASE, rebase, isSettled: true })).toMatchObject({
      text: 'Rebased by Auto',
      icon: 'auto',
      isBreathing: false,
    });
    expect(branchRowChipOf({ ...BASE, rebase, isSettled: true, isBatchSettled: true })).toBeNull();
  });

  it('says Failed with the reason and keeps the other states quiet', () => {
    expect(
      branchRowChipOf({
        ...BASE,
        rebase: { ...branchOf({ state: 'failed' }), message: 'Offline' },
      }),
    ).toMatchObject({ text: 'Failed', reason: 'Offline' });
    expect(branchRowChipOf({ ...BASE, rebase: branchOf({ state: 'rebased' }) })).toBeNull();
    expect(branchRowChipOf({ ...BASE, rebase: branchOf({ state: 'queued' }) })?.text).toBe(
      'Queued',
    );
  });
});

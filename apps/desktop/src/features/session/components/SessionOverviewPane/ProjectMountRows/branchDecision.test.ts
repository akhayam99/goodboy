import { describe, expect, it } from 'vitest';
import type { IsoDateTime, MountBranchObservation, MountId, SessionId } from '@goodboy/types';
import { buildBranchDecision } from './branchDecision';

const observation: MountBranchObservation = {
  mountId: 'mount-1' as MountId,
  sessionId: 'session-1' as SessionId,
  state: 'mismatch',
  recordedBranch: 'ak/part-one',
  observedBranch: 'ak/part-two',
  revision: 1,
  observedAt: '2026-09-08T10:00:00.000Z' as IsoDateTime,
};

describe('buildBranchDecision', () => {
  it('carries no per-button narration', () => {
    const decision = buildBranchDecision({ observation, projectName: 'ledger-core', holder: null });

    expect(decision).not.toBeNull();
    expect(Object.keys(decision ?? {})).toEqual(['title', 'description', 'confirm', 'alt']);
  });

  it('drops the adopt action when the branch is held elsewhere', () => {
    const decision = buildBranchDecision({
      observation,
      projectName: 'ledger-core',
      holder: { mountId: null, label: null },
    });

    expect(decision?.confirm).toEqual({
      label: 'Check again',
      resolution: 'recheck',
      isDisabled: false,
    });
    expect(decision?.alt).toBeNull();
  });

  it('keeps adopt disabled while the holder check runs', () => {
    const decision = buildBranchDecision({
      observation,
      projectName: 'ledger-core',
      holder: 'checking',
    });

    expect(decision?.confirm.resolution).toBe('adopt-observed');
    expect(decision?.confirm.isDisabled).toBe(true);
  });

  it('explains keep both in one sentence after the cause', () => {
    const decision = buildBranchDecision({ observation, projectName: 'ledger-core', holder: null });

    expect(decision?.alt?.resolution).toBe('keep-both');
    expect(decision?.description).toBe(
      'Expected ak/part-one, found ak/part-two. Keep both branches records ak/part-two here and mounts ak/part-one again in a row of its own.',
    );
  });

  it('offers check again first for a detached mount whose branch is held', () => {
    const decision = buildBranchDecision({
      observation: { ...observation, state: 'detached', observedBranch: null },
      projectName: 'ledger-core',
      holder: { mountId: 'mount-2' as MountId, label: 'PR #418' },
    });

    expect(decision?.confirm.resolution).toBe('recheck');
    expect(decision?.alt).toBeNull();
  });
});

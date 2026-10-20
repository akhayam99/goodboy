import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import type { AgentId, AutoTreeId, SessionId } from '@goodboy/types';
import type { AutoTree } from '@goodboy/db';
import type { AdmissionSnapshot } from './admission';
import { diagnoseResume } from './resumeAdmission';

const NOW = 1_700_000_000_000;
const ROOT = brandId<AgentId>({ value: 'agent-auto-root' });

const tree = (patch: Partial<AutoTree> = {}): AutoTree => ({
  id: brandId<AutoTreeId>({ value: 'tree-1' }),
  rootAgentId: ROOT,
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  primaryMountId: 'mount-ledger-core',
  generation: 1,
  phase: 'deciding',
  phaseRev: 3,
  blockedReason: null,
  activeRunId: 'run-1',
  activeDeliveryId: null,
  isYieldRequested: false,
  stopState: 'none',
  capUsd: 5,
  turnsUsed: 1,
  delegationsUsed: 1,
  attemptsUsed: 1,
  refusalsUsed: 0,
  turnDelegateCalls: 0,
  noProgressStreak: 0,
  questionCycles: 0,
  grants: 0,
  createdAt: NOW,
  updatedAt: NOW,
  hardDeadlineAt: NOW + 86_400_000,
  schedulerOwner: 'window-a',
  ownerLeaseExpiresAt: NOW + 30_000,
  ...patch,
});

const snapshot = (patch: Partial<AdmissionSnapshot> = {}): AdmissionSnapshot => ({
  tree: tree(),
  ownerId: 'window-a',
  nowMs: NOW,
  callerAgentId: ROOT,
  expectedGeneration: 1,
  expectedRunId: 'run-1',
  openCount: 1,
  openChildAgentIds: ['agent-scout-1'],
  remainingUsd: 5,
  artifacts: [],
  isPlanApprovalRequired: true,
  ...patch,
});

describe('admitting the resume of a child that asked a question', () => {
  it('reserves a ceiling for the new attempt', () => {
    const verdict = diagnoseResume({ snapshot: snapshot(), role: 'scout' });
    expect(verdict.kind).toBe('ok');
    expect(verdict.kind === 'ok' && verdict.ceilingUsd > 0).toBe(true);
  });

  it('still answers after the same turn handed other work over', () => {
    const handed = snapshot({ tree: tree({ phase: 'delegating', isYieldRequested: true }) });
    expect(diagnoseResume({ snapshot: handed, role: 'scout' }).kind).toBe('ok');
  });

  it('refuses the resume of a paused child when the running slots are full', () => {
    const full = snapshot({ openCount: 4 });
    expect(diagnoseResume({ snapshot: full, role: 'scout' })).toEqual({
      kind: 'refused',
      code: 'breadth_cap',
    });
    const free = snapshot({ openCount: 3 });
    expect(diagnoseResume({ snapshot: free, role: 'scout' }).kind).toBe('ok');
  });

  it('refuses outside the turn it was called from', () => {
    const idle = snapshot({ tree: tree({ phase: 'waiting', activeRunId: null }) });
    expect(diagnoseResume({ snapshot: idle, role: 'scout' })).toEqual({
      kind: 'refused',
      code: 'not_deciding',
    });
    const other = snapshot({ expectedRunId: 'run-2' });
    expect(diagnoseResume({ snapshot: other, role: 'scout' })).toEqual({
      kind: 'refused',
      code: 'not_deciding',
    });
  });

  it('refuses a stopped tree, a restarted tree and a foreign owner', () => {
    const stopped = snapshot({ tree: tree({ stopState: 'requested' }) });
    expect(diagnoseResume({ snapshot: stopped, role: 'scout' })).toEqual({
      kind: 'refused',
      code: 'tree_stopped',
    });
    const restarted = snapshot({ expectedGeneration: 2 });
    expect(diagnoseResume({ snapshot: restarted, role: 'scout' })).toEqual({
      kind: 'refused',
      code: 'generation_changed',
    });
    const foreign = snapshot({ ownerId: 'window-b' });
    expect(diagnoseResume({ snapshot: foreign, role: 'scout' })).toEqual({
      kind: 'refused',
      code: 'not_owner',
    });
  });

  it('resumes whatever the attempt count, and stops at the budget', () => {
    const spent = snapshot({ tree: tree({ attemptsUsed: 20 }) });
    expect(diagnoseResume({ snapshot: spent, role: 'scout' }).kind).toBe('ok');
    const broke = snapshot({ remainingUsd: 0 });
    expect(diagnoseResume({ snapshot: broke, role: 'scout' })).toEqual({
      kind: 'refused',
      code: 'budget',
    });
  });
});

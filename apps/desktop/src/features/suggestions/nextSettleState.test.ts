// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { EMPTY_SETTLE, SETTLE_MS, nextSettleState } from './nextSettleState';
import type { NextStepSignals } from './nextStepSignals';
import type { SuggestionMount } from './deriveNextSteps';
import type { NextMove } from './types';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });

const rerun: NextMove = {
  id: 'rerun-check:mount-ledger-core',
  kind: 'rerun-check',
  priority: 13,
  band: 1,
  title: 'Rerun integration-tests',
  detail: 'timed out',
  sessionId: SESSION,
  targetKey: 'pr:mount-ledger-core',
  fingerprint: 'rerun-check:mount-ledger-core:418:9001',
  payload: {
    mountId: MOUNT,
    prNumber: 418,
    checkName: 'integration-tests',
    runId: '9001',
    cwd: '/work/ledger-core',
  },
  reason: 'timed out',
  evidence: [],
  place: { tool: 'checks', mountId: MOUNT, agentId: null },
  completesWhen: { kind: 'check-passes', mountId: MOUNT, checkName: 'integration-tests' },
  group: 'unblock',
  read: null,
};

const mountWith = (checks: 'success' | 'failure'): SuggestionMount => ({
  mountId: MOUNT,
  projectId: brandId({ value: 'project-ledger-core' }),
  projectName: 'ledger-core',
  branch: 'feature/rounding',
  worktreePath: '/work/ledger-core',
  push: null,
  aheadOfBase: null,
  isClean: true,
  pr: {
    number: 418,
    title: 't',
    url: 'u',
    state: 'open',
    mergeable: true,
    checks,
    baseBranch: 'main',
    headBranch: 'h',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '',
  },
  fetchedAt: null,
});

const signalsWith = (
  checks: 'success' | 'failure',
  extra: Partial<NextStepSignals> = {},
): NextStepSignals => ({
  sessionId: SESSION,
  workflowRuns: [],
  plans: [],
  consumedPlanIds: new Set(),
  openQuestionCount: 0,
  hasPullRequest: false,
  eligibleThreadCount: 0,
  mountEvents: [],
  projects: [],
  mounts: [mountWith(checks)],
  ...extra,
});

describe('nextSettleState', () => {
  const T0 = 1_000_000;

  it('leaves a quiet row for two seconds when the check passed after the move went', () => {
    const shown = nextSettleState({
      state: EMPTY_SETTLE,
      moves: [rerun],
      signals: signalsWith('failure'),
      now: T0,
    });
    expect(shown.rows).toEqual([]);
    const settled = nextSettleState({
      state: shown,
      moves: [],
      signals: signalsWith('success'),
      now: T0 + 500,
    });
    expect(settled.rows).toEqual([
      {
        id: rerun.id,
        kind: 'rerun-check',
        text: 'integration-tests passed on rerun',
        until: T0 + 500 + SETTLE_MS,
      },
    ]);
  });

  it('lets the row go once two seconds are over', () => {
    const settled = nextSettleState({
      state: { seen: new Map([[rerun.id, rerun]]), rows: [] },
      moves: [],
      signals: signalsWith('success'),
      now: T0,
    });
    const later = nextSettleState({
      state: settled,
      moves: [],
      signals: signalsWith('success'),
      now: T0 + SETTLE_MS + 1,
    });
    expect(later.rows).toEqual([]);
  });

  it('leaves no row when the move went away while its check still fails', () => {
    const next = nextSettleState({
      state: { seen: new Map([[rerun.id, rerun]]), rows: [] },
      moves: [],
      signals: signalsWith('failure'),
      now: T0,
    });
    expect(next.rows).toEqual([]);
  });

  it('leaves no row for a move the user set aside with Not now', () => {
    const next = nextSettleState({
      state: { seen: new Map([[rerun.id, rerun]]), rows: [] },
      moves: [],
      signals: signalsWith('success', { dismissedFingerprints: new Set([rerun.fingerprint]) }),
      now: T0,
    });
    expect(next.rows).toEqual([]);
  });

  it('leaves no row while the move is still there', () => {
    const next = nextSettleState({
      state: { seen: new Map([[rerun.id, rerun]]), rows: [] },
      moves: [rerun],
      signals: signalsWith('success'),
      now: T0,
    });
    expect(next.rows).toEqual([]);
  });
});

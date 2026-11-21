// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import type { SuggestionMount } from './deriveNextSteps';
import { isMoveDone } from './isMoveDone';
import type { NextStepSignals } from './nextStepSignals';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const SCRIPT = 'script-db-generate';

const mountOf = ({
  aggregate,
  checks,
}: Pick<SuggestionMount, 'checks'> & { aggregate: 'success' | 'failure' }): SuggestionMount => ({
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
    checks: aggregate,
    baseBranch: 'main',
    headBranch: 'h',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '',
  },
  fetchedAt: null,
  checks,
});

const signalsOf = (extra: Partial<NextStepSignals>): NextStepSignals => ({
  sessionId: SESSION,
  workflowRuns: [],
  plans: [],
  consumedPlanIds: new Set(),
  openQuestionCount: 0,
  hasPullRequest: false,
  eligibleThreadCount: 0,
  mountEvents: [],
  projects: [],
  ...extra,
});

describe('isMoveDone check-passes', () => {
  const integration = {
    kind: 'check-passes',
    mountId: MOUNT,
    checkName: 'integration-tests',
  } as const;

  it('is done when the named check passed, whatever the other checks do', () => {
    const mounts = [
      mountOf({
        aggregate: 'failure',
        checks: [
          { name: 'integration-tests', conclusion: 'success' },
          { name: 'lint', conclusion: 'failure' },
        ],
      }),
    ];
    expect(isMoveDone({ completesWhen: integration, signals: signalsOf({ mounts }) })).toBe(true);
  });

  it('is not done while the named check still fails or runs, even if the others pass', () => {
    const failing = [
      mountOf({
        aggregate: 'failure',
        checks: [
          { name: 'integration-tests', conclusion: 'failure' },
          { name: 'lint', conclusion: 'success' },
        ],
      }),
    ];
    const running = [
      mountOf({
        aggregate: 'success',
        checks: [{ name: 'integration-tests', conclusion: 'pending' }],
      }),
    ];
    expect(
      isMoveDone({ completesWhen: integration, signals: signalsOf({ mounts: failing }) }),
    ).toBe(false);
    expect(
      isMoveDone({ completesWhen: integration, signals: signalsOf({ mounts: running }) }),
    ).toBe(false);
  });

  it('uses the aggregate result only for a move that needs every check to pass', () => {
    const all = { kind: 'check-passes', mountId: MOUNT, checkName: null } as const;
    const oneLeft = [
      mountOf({
        aggregate: 'failure',
        checks: [{ name: 'integration-tests', conclusion: 'success' }],
      }),
    ];
    const passed = [mountOf({ aggregate: 'success', checks: [] })];
    expect(isMoveDone({ completesWhen: all, signals: signalsOf({ mounts: oneLeft }) })).toBe(false);
    expect(isMoveDone({ completesWhen: all, signals: signalsOf({ mounts: passed }) })).toBe(true);
  });
});

describe('isMoveDone script-succeeds', () => {
  const generate = {
    kind: 'script-succeeds',
    scriptId: SCRIPT,
    scriptName: 'db:generate',
    sinceMs: 5_000,
  } as const;

  const runOf = ({
    completedAt,
    isOk = true,
    scriptId = SCRIPT,
  }: {
    completedAt: number;
    isOk?: boolean;
    scriptId?: string;
  }) => ({
    scriptId,
    mountId: MOUNT,
    name: 'db:generate',
    isOk,
    completedAt,
  });

  it('is not done by a success from before the turn that triggered the move', () => {
    expect(
      isMoveDone({
        completesWhen: generate,
        signals: signalsOf({ scriptRuns: [runOf({ completedAt: 4_000 })] }),
      }),
    ).toBe(false);
  });

  it('is done by a success at or after that turn', () => {
    expect(
      isMoveDone({
        completesWhen: generate,
        signals: signalsOf({ scriptRuns: [runOf({ completedAt: 5_000 })] }),
      }),
    ).toBe(true);
  });

  it('is not done by a failed run or by the same script name in another place', () => {
    const runs = [
      runOf({ completedAt: 6_000, isOk: false }),
      runOf({ completedAt: 6_000, scriptId: 'script-db-generate-in-another-package' }),
    ];
    expect(isMoveDone({ completesWhen: generate, signals: signalsOf({ scriptRuns: runs }) })).toBe(
      false,
    );
  });
});

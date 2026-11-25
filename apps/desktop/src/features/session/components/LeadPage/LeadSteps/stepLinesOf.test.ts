// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AutoGuideView } from '../../../../../store/slices/auto-view/state';
import { aDelegation } from '../../../../auto/testing/autoViewFixtures';
import { stepLinesOf } from './stepLinesOf';

const GUIDE: AutoGuideView = {
  workflowId: 'workflow-feature',
  name: 'Ship a feature',
  check: 'passed',
  steps: [
    { name: 'Find what it touches', role: 'scout' },
    { name: 'Write the plan', role: 'planner' },
    { name: 'Build it', role: 'implementer' },
    { name: 'Review the change', role: 'reviewer' },
  ],
  deviations: [],
};

const statesOf = (lines: ReturnType<typeof stepLinesOf>) => lines.map((line) => line.state);

describe('stepLinesOf', () => {
  it('marks done, running and not started from the delegations of each role', () => {
    const lines = stepLinesOf({
      guide: GUIDE,
      delegations: [
        aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome: 'completed' }),
        aDelegation({ key: 'plan', role: 'planner', state: 'running' }),
      ],
    });

    expect(statesOf(lines)).toEqual(['done', 'running', 'queued', 'queued']);
  });

  it('marks the first step that waits as needing you while the check holds', () => {
    const lines = stepLinesOf({ guide: { ...GUIDE, check: 'held' }, delegations: [] });

    expect(statesOf(lines)).toEqual(['attention', 'queued', 'queued', 'queued']);
    expect(lines[0]?.note).toBe('Stopped at the first check');
  });

  it('shows a skipped step with its reason and keeps it in place', () => {
    const lines = stepLinesOf({
      guide: {
        ...GUIDE,
        deviations: [
          { change: 'skipped', step: 'find what it touches', reason: 'findings carried over' },
        ],
      },
      delegations: [],
    });

    expect(lines.map((line) => line.name)).toEqual(GUIDE.steps.map((step) => step.name));
    expect(lines[0]).toMatchObject({
      state: 'skipped',
      note: 'Skipped: findings carried over',
    });
  });

  it('adds an added step with its reason and marks a moved one', () => {
    const lines = stepLinesOf({
      guide: {
        ...GUIDE,
        deviations: [
          { change: 'added', step: 'Add a rounding mode flag', reason: 'Both modes are needed.' },
          { change: 'moved', step: 'Review the change', reason: 'Review before the build.' },
        ],
      },
      delegations: [],
    });

    expect(lines).toHaveLength(5);
    expect(lines[4]).toMatchObject({
      ordinal: '+',
      name: 'Add a rounding mode flag',
      state: 'added',
      change: 'added',
      reason: 'Both modes are needed.',
    });
    expect(lines[3]).toMatchObject({ change: 'moved', reason: 'Review before the build.' });
  });

  it('pairs a repeated role with its own delegation in order', () => {
    const lines = stepLinesOf({
      guide: {
        ...GUIDE,
        steps: [
          { name: 'Build the first half', role: 'implementer' },
          { name: 'Build the second half', role: 'implementer' },
        ],
      },
      delegations: [
        aDelegation({ key: 'one', role: 'implementer', state: 'settled', outcome: 'completed' }),
      ],
    });

    expect(statesOf(lines)).toEqual(['done', 'queued']);
  });

  it('counts a retry as the same step, with the latest attempt deciding', () => {
    const failed = aDelegation({
      key: 'build-1',
      role: 'implementer',
      state: 'settled',
      outcome: 'failed',
    });
    const retried = {
      ...aDelegation({
        key: 'build-2',
        role: 'implementer',
        state: 'settled',
        outcome: 'completed',
      }),
      retryOf: failed.id,
      createdAt: failed.createdAt + 1,
    };

    const lines = stepLinesOf({
      guide: {
        ...GUIDE,
        steps: [
          { name: 'Build it', role: 'implementer' },
          { name: 'Check it', role: 'implementer' },
        ],
      },
      delegations: [failed, retried],
    });

    expect(statesOf(lines)).toEqual(['done', 'queued']);
  });

  it('shows queued and paused helpers as not started, never as running', () => {
    const lines = stepLinesOf({
      guide: GUIDE,
      delegations: [
        aDelegation({ key: 'scout', role: 'scout', state: 'accepted' }),
        aDelegation({ key: 'plan', role: 'planner', state: 'paused' }),
        aDelegation({ key: 'build', role: 'implementer', state: 'starting' }),
      ],
    });

    expect(statesOf(lines)).toEqual(['queued', 'queued', 'running', 'queued']);
  });

  it('does not spend a delegation on a skipped step of the same role', () => {
    const lines = stepLinesOf({
      guide: {
        ...GUIDE,
        steps: [
          { name: 'Build the first half', role: 'implementer' },
          { name: 'Build the second half', role: 'implementer' },
        ],
        deviations: [{ change: 'skipped', step: 'Build the first half', reason: 'Not needed.' }],
      },
      delegations: [
        aDelegation({ key: 'one', role: 'implementer', state: 'settled', outcome: 'completed' }),
      ],
    });

    expect(statesOf(lines)).toEqual(['skipped', 'done']);
  });
});

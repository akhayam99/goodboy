import { describe, expect, it } from 'vitest';
import type { AutoDelegation } from '@goodboy/db';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { aDelegation, aPlanRow, aView } from '../testing/autoViewFixtures';
import { delegationCardOf } from './delegationCardOf';
import { nextActionOf, nextStepMessageOf } from './nextActionOf';

type ActionParams = {
  readonly delegation: AutoDelegation;
  readonly view?: AutoTreeView;
};

const actionOf = ({
  delegation,
  view = aView({ phase: 'waiting', delegations: [delegation] }),
}: ActionParams) =>
  nextActionOf({ view, delegation, card: delegationCardOf({ delegation, childAgent: null }) });

describe('nextActionOf', () => {
  it('names the primary after the role and keeps at most two alternatives with their roles', () => {
    const action = actionOf({
      delegation: aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'awaiting_confirm',
        alternatives: [
          { label: 'Spawn a tester first', role: 'tester' },
          { label: 'Ask a reviewer', role: 'reviewer' },
          { label: 'A third one', role: 'scout' },
        ],
      }),
    });

    expect(action.choices.map((choice) => choice.label)).toEqual([
      'Spawn implementer',
      'Spawn a tester first',
      'Ask a reviewer',
    ]);
    expect(action.choices.map((choice) => choice.role)).toEqual([null, 'tester', 'reviewer']);
  });

  it('drops an alternative with an unknown role or no label', () => {
    const action = actionOf({
      delegation: aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'awaiting_confirm',
        alternatives: [
          { label: 'Do magic', role: 'wizard' },
          { label: '', role: 'tester' },
        ],
      }),
    });

    expect(action.choices).toHaveLength(1);
  });

  it('names the plan and version a revision would change', () => {
    const delegation = aDelegation({
      key: 'planner-2',
      role: 'planner',
      state: 'awaiting_confirm',
      reviseOf: 'artifact-plan',
      baseRevision: 2,
    });
    const action = actionOf({
      delegation,
      view: aView({
        phase: 'waiting',
        delegations: [delegation],
        artifacts: [{ ...aPlanRow({ revision: 2 }), title: 'Retry-safe credit retries' }],
      }),
    });

    expect(action.choices[0]?.label).toBe('Revise Retry-safe credit retries to v3');
  });
});

describe('nextStepMessageOf', () => {
  it('puts the machine readable role on the first line and the hint after it', () => {
    const choice = { key: 'alternative-0', label: 'Spawn a tester first', role: 'tester' as const };

    expect(nextStepMessageOf({ choice, hint: '  cover refunds ' })).toBe(
      'Next step: tester\ncover refunds',
    );
    expect(nextStepMessageOf({ choice, hint: '   ' })).toBe('Next step: tester');
  });
});

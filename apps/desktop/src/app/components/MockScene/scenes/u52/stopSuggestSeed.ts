import type { AutoGuideView, AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { aDelegation, aView } from '../../../../../features/auto/testing/autoViewFixtures';

export type StopSuggestState = 'stopped' | 'switched' | 'deviated';

const BUG_STEPS: AutoGuideView['steps'] = [
  { name: 'First, check', role: 'scout' },
  { name: 'Reproduce and find the cause', role: 'debugger' },
  { name: 'Fix it', role: 'implementer' },
  { name: 'Prove it stays fixed', role: 'tester' },
];

const FEATURE_STEPS: AutoGuideView['steps'] = [
  { name: 'Find what it touches', role: 'scout' },
  { name: 'Write the plan, wait for your OK', role: 'planner' },
  { name: 'Build it', role: 'implementer' },
  { name: 'Review the change', role: 'reviewer' },
];

const REASON =
  'Changing how the export rounds is a feature: plan it, get your OK, then change it. Rounding each line matches the settlement spec.';

type Params = {
  readonly state: StopSuggestState;
};

export const stopSuggestViewOf = ({ state }: Params): AutoTreeView => {
  if (state === 'stopped') {
    return {
      ...aView({ phase: 'done', rootAsk: 'Fix the rounding drift in the settlement export' }),
      hold: { reason: REASON, suggestion: 'Ship a feature', suggestionId: 'workflow-feature' },
      guide: {
        workflowId: 'workflow-bug',
        name: 'Fix a bug',
        check: 'held',
        steps: BUG_STEPS,
        deviations: [],
      },
    };
  }
  const delegations =
    state === 'switched'
      ? [aDelegation({ key: 'plan', role: 'planner', state: 'running' })]
      : [
          aDelegation({ key: 'plan', role: 'planner', state: 'settled', outcome: 'completed' }),
          aDelegation({ key: 'build', role: 'implementer', state: 'running' }),
        ];
  return {
    ...aView({
      phase: 'answering',
      delegations,
      rootAsk: 'Fix the rounding drift in the settlement export',
    }),
    hold: null,
    guide: {
      workflowId: 'workflow-feature',
      name: 'Ship a feature',
      check: 'passed',
      steps: FEATURE_STEPS,
      deviations: [
        { change: 'skipped', step: 'Find what it touches', reason: 'findings carried over' },
        ...(state === 'deviated'
          ? ([
              {
                change: 'added',
                step: 'Add a rounding mode flag',
                reason: 'Merchants need both modes during the switch.',
              },
            ] as const)
          : []),
      ],
    },
  };
};

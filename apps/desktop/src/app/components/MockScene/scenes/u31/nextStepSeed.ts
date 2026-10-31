import { useAppStore } from '../../../../../store';
import { AUTO_SESSION } from '../u24/autoSceneSeed';
import { seedC07 } from '../u25/c07/c07AutoSeed';

const ALTERNATIVES = [
  { label: 'Spawn a scout first', role: 'scout' },
  { label: 'Spawn an implementer', role: 'implementer' },
] as const;

const TASK = 'Plan how payments-api handles two webhooks for the same credit.';

export const seedNextStep = (): void => {
  seedC07({ state: 'confirm', place: 'session' });
  useAppStore.setState((state) => {
    const view = state.autoTreeViews[AUTO_SESSION.id]?.[0];
    if (view === undefined) {
      return {};
    }
    return {
      autoTreeViews: {
        ...state.autoTreeViews,
        [AUTO_SESSION.id]: [
          {
            ...view,
            delegations: view.delegations.map((delegation) =>
              delegation.state === 'awaiting_confirm'
                ? {
                    ...delegation,
                    reviseOf: null,
                    request: { ...delegation.request, task: TASK, alternatives: ALTERNATIVES },
                  }
                : delegation,
            ),
          },
        ],
      },
    };
  });
};

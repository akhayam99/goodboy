import { useAppStore } from '../../../../../store';
import { AUTO_SESSION } from '../u24/autoSceneSeed';
import { seedC07 } from '../u25/c07/c07AutoSeed';

const ALTERNATIVES = [
  { label: 'Spawn a tester first', role: 'tester' },
  { label: 'Spawn an implementer', role: 'implementer' },
] as const;

export const seedC2NextStep = (): void => {
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
                    request: { ...delegation.request, alternatives: ALTERNATIVES },
                  }
                : delegation,
            ),
          },
        ],
      },
    };
  });
};

import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { AUTO_ROOT_ID, AUTO_SESSION, IMPLEMENTER_ID, TESTER_ID } from '../u24/autoSceneSeed';
import { seedC07 } from '../u25/c07/c07AutoSeed';

type Params = {
  readonly hasTwoChildren: boolean;
};

const clock = sceneClock({ anchor: '2026-10-13T12:12:00Z' });

export const seedE2WorkingNow = ({ hasTwoChildren }: Params): void => {
  seedC07({ state: 'working', place: 'session' });
  useAppStore.setState((state) => {
    const view = state.autoTreeViews[AUTO_SESSION.id]?.[0];
    const runningTurn = state.agentTurnState[IMPLEMENTER_ID];
    if (view === undefined || runningTurn?.kind !== 'running') {
      return {};
    }
    return {
      autoTreeViews: {
        ...state.autoTreeViews,
        [AUTO_SESSION.id]: [
          {
            ...view,
            delegations: view.delegations.map((delegation) =>
              hasTwoChildren && delegation.childAgentId === TESTER_ID
                ? {
                    ...delegation,
                    state: 'running' as const,
                    createdAt: clock.ms({ at: '2026-10-13T12:11:30Z' }),
                  }
                : delegation,
            ),
          },
        ],
      },
      agentTurnState: {
        ...state.agentTurnState,
        [AUTO_ROOT_ID]: { ...runningTurn, startedAt: clock.iso({ at: '2026-10-13T12:11:55Z' }) },
        ...(hasTwoChildren
          ? {
              [TESTER_ID]: { ...runningTurn, startedAt: clock.iso({ at: '2026-10-13T12:11:30Z' }) },
            }
          : {}),
      },
    };
  });
};

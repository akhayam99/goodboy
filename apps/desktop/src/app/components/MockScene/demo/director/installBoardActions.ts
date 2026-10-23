import type { DirectorStore } from './directorTypes';
import { installDemoWorld } from './installDemoWorld';

type Params = {
  readonly store: DirectorStore;
};

type FilledParams<T> = {
  readonly current: Readonly<Record<string, T>>;
  readonly ids: ReadonlyArray<string>;
  readonly empty: T;
};

const filled = <T>({ current, ids, empty }: FilledParams<T>): Readonly<Record<string, T>> =>
  Object.fromEntries(ids.map((id) => [id, current[id] ?? empty]));

export const installBoardActions = ({ store }: Params): void => {
  installDemoWorld({ store });
  const state = store.getState();
  const ids = state.sessions.map((session) => session.id);
  store.setState({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      ...filled({ current: state.sessionPhaseRuns, ids, empty: [] }),
    },
    sessionPlans: {
      ...state.sessionPlans,
      ...filled({ current: state.sessionPlans, ids, empty: [] }),
    },
    sessionWorkflows: {
      ...state.sessionWorkflows,
      ...filled({ current: state.sessionWorkflows, ids, empty: [] }),
    },
    sessionExternalTasks: {
      ...state.sessionExternalTasks,
      ...filled({ current: state.sessionExternalTasks, ids, empty: [] }),
    },
    sessionSlots: {
      ...Object.fromEntries(
        state.sessions.map((session) => [
          session.id,
          [{ key: 'goal', value: session.goal, enabled: true }],
        ]),
      ),
      ...state.sessionSlots,
    },
    sessionSlotsLoad: {
      ...Object.fromEntries(ids.map((id) => [id, 'loaded' as const])),
      ...state.sessionSlotsLoad,
    },
    loadPhaseRunsForSession: async () => undefined,
    loadSessionPlans: async () => undefined,
  });
};

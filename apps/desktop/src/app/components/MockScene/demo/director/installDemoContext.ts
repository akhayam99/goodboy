import type { ContextSlot, Session } from '@goodboy/types';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

type SlotsParams = {
  readonly session: Session;
};

const slotsOf = ({ session }: SlotsParams): ReadonlyArray<ContextSlot> => [
  { key: 'goal', value: session.goal, enabled: true },
  { key: 'decisions', value: '', enabled: true },
  { key: 'last_output_summary', value: '', enabled: true },
];

export const installDemoContext = ({ store }: Params): void => {
  const state = store.getState();
  const quiet = state.sessions.filter(
    (session) => state.sessionSlotsLoad[session.id] === undefined,
  );
  if (quiet.length === 0) {
    return;
  }
  store.setState((current) => ({
    sessionSlots: {
      ...current.sessionSlots,
      ...Object.fromEntries(quiet.map((session) => [session.id, slotsOf({ session })])),
    },
    sessionSlotsLoad: {
      ...current.sessionSlotsLoad,
      ...Object.fromEntries(quiet.map((session) => [session.id, 'loaded' as const])),
    },
    sessionDecisions: {
      ...Object.fromEntries(quiet.map((session) => [session.id, []])),
      ...current.sessionDecisions,
    },
  }));
};

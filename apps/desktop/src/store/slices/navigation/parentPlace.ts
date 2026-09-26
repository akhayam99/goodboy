import type { AppState } from '../../types';
import { agentHomeFor } from './agentHomeFor';
import { sessionPlace } from './place';
import type { Place } from './types';

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

export const parentPlace = ({ state, place }: Params): Place | null => {
  if (place.at === 'board') {
    return null;
  }
  const { sessionId, view } = place;
  if (view.studio !== null) {
    return { ...place, view: { ...view, studio: null } };
  }
  if (view.agentId !== null) {
    const home = agentHomeFor({ state, sessionId, agentId: view.agentId }) ?? view.lens;
    const runId =
      home === 'workflows'
        ? ((state.sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === view.agentId)
            ?.workflowRunId ?? null)
        : null;
    return sessionPlace({
      sessionId,
      lens: home,
      target: runId === null ? null : { kind: 'run', runId },
    });
  }
  if (view.target !== null && view.target.kind !== 'diff' && view.target.kind !== 'terminal') {
    return { ...place, view: { ...view, target: null } };
  }
  if (view.lens !== null) {
    return sessionPlace({ sessionId });
  }
  return null;
};

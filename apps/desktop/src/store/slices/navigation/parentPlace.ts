import type { AppState } from '../../types';
import { agentHomeFor } from './agentHomeFor';
import { sessionPlace } from './place';
import type { Place } from './types';

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

export const parentPlace = ({ state, place }: Params): Place | null => {
  if (place.at === 'board' || place.at === 'session-draft') {
    return null;
  }
  const { sessionId, view } = place;
  if (view.studio !== null) {
    return { ...place, view: { ...view, studio: null } };
  }
  if (view.target?.kind === 'branch') {
    const { target } = view;
    if (target.page === 'history') {
      return { ...place, view: { ...view, target: { ...target, page: null } } };
    }
    if (target.threadId !== null) {
      return { ...place, view: { ...view, target: { ...target, threadId: null } } };
    }
    if (target.tab === 'files' && target.focus?.path != null) {
      return {
        ...place,
        view: { ...view, target: { ...target, focus: { ...target.focus, path: null } } },
      };
    }
    return sessionPlace({ sessionId });
  }
  if (view.agentId !== null && view.target?.kind === 'thread' && view.lens === 'review') {
    return sessionPlace({
      sessionId,
      lens: 'review',
      target: { kind: 'thread', threadId: view.target.threadId },
    });
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
  if (
    view.target !== null &&
    view.target.kind !== 'diff' &&
    view.target.kind !== 'terminal' &&
    view.target.kind !== 'thread'
  ) {
    return { ...place, view: { ...view, target: null } };
  }
  if (view.lens !== null) {
    return sessionPlace({ sessionId });
  }
  return null;
};

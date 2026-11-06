import type { AppState } from '../../types';
import { agentHomeFor } from './agentHomeFor';
import { sessionPlace } from './place';
import { placeBeforeDraft } from './placeBeforeDraft';
import type { Place } from './types';

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

export const parentPlace = ({ state, place }: Params): Place | null => {
  if (place.at === 'board') {
    return null;
  }
  if (place.at === 'session-draft') {
    return placeBeforeDraft({ state });
  }
  const { sessionId, view } = place;
  if (view.target?.kind === 'branch') {
    const { target } = view;
    if (target.threadId !== null) {
      return { ...place, view: { ...view, target: { ...target, threadId: null } } };
    }
    if (target.tab === 'files' && target.focus?.path != null) {
      const isPlainFile = target.focus.kind === 'branch' && target.focus.threadId == null;
      return {
        ...place,
        view: {
          ...view,
          target: {
            ...target,
            focus: isPlainFile ? null : { ...target.focus, path: null },
          },
        },
      };
    }
    return sessionPlace({ sessionId });
  }
  if (view.agentId !== null && view.target?.kind === 'thread' && view.lens === 'review') {
    return sessionPlace({ sessionId, lens: 'review' });
  }
  if (view.agentId !== null) {
    const agents = state.sessionPhaseRuns[sessionId] ?? [];
    const agent = agents.find((candidate) => candidate.id === view.agentId);
    const parentAgentId = agent?.parentAgentId ?? null;
    const isStep = agent?.workflowRunId != null && agent.stepId != null;
    const parent = agents.find((candidate) => candidate.id === parentAgentId);
    const isParentStepOfRun =
      parent?.workflowRunId != null &&
      parent.stepId != null &&
      parent.workflowRunId === agent?.workflowRunId;
    const home = agentHomeFor({ state, sessionId, agentId: view.agentId }) ?? view.lens;
    if (
      (!isStep || isParentStepOfRun) &&
      parentAgentId !== null &&
      parentAgentId !== view.agentId &&
      parent !== undefined
    ) {
      return sessionPlace({ sessionId, lens: home, agentId: parentAgentId });
    }
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
  if (view.target !== null && view.target.kind !== 'diff' && view.target.kind !== 'thread') {
    return { ...place, view: { ...view, target: null } };
  }
  if (view.lens !== null) {
    return sessionPlace({ sessionId });
  }
  return null;
};

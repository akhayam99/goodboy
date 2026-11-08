import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly state: Pick<AppState, 'sessions' | 'sessionWorkflows' | 'phaseTemplates'>;
  readonly sessionId: SessionId;
  readonly runId: string;
};

export const runTitleOf = ({ state, sessionId, runId }: Params): string | null => {
  const session = sessionById(state.sessions, sessionId) ?? null;
  const run = session?.workflowRuns.find((candidate) => candidate.id === runId) ?? null;
  if (run === null) {
    return null;
  }
  if (run.title != null && run.title.trim() !== '') {
    return run.title;
  }
  const workflows = [
    ...(state.sessionWorkflows[sessionId] ?? []),
    ...(session === null ? [] : (state.phaseTemplates[session.workspaceId] ?? [])),
  ];
  return workflows.find((workflow) => workflow.id === run.workflowId)?.name ?? null;
};

import type { SessionExternalTask, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type State = Pick<AppState, 'sessionExternalTasks' | 'trackerMoveSettled'>;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
};

const MOVABLE: ReadonlySet<string> = new Set(['linear', 'jira']);

export const trackerTasksOf = ({
  state,
  sessionId,
}: Params): ReadonlyArray<SessionExternalTask> => {
  const settled = state.trackerMoveSettled[sessionId] ?? [];
  return (state.sessionExternalTasks[sessionId] ?? []).filter(
    (task) =>
      MOVABLE.has(task.provider) &&
      task.relation !== 'part-of' &&
      !settled.includes(`${task.provider}:${task.externalId}`),
  );
};

import type { Session, SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { UNTITLED_BASE } from '../../../../session/sessionTitle';

export const SAMPLE_GOAL = 'Fix the login redirect';
export const SAMPLE_TASK_ID = 'ENG-412';

type SourceState = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionExternalTasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>;
};

type Params = {
  readonly state: SourceState;
  readonly workspaceId: WorkspaceId;
};

const lastSessionOf = ({ state, workspaceId }: Params): Session | null =>
  state.sessions
    .filter(
      (session) =>
        session.workspaceId === workspaceId &&
        session.goal.trim() !== '' &&
        session.goal.trim() !== UNTITLED_BASE,
    )
    .reduce<Session | null>(
      (latest, session) =>
        latest === null || session.createdAt > latest.createdAt ? session : latest,
      null,
    );

export const lastSessionGoal = ({ state, workspaceId }: Params): string | null =>
  lastSessionOf({ state, workspaceId })?.goal ?? null;

export const lastSessionTaskId = ({ state, workspaceId }: Params): string | null => {
  const session = lastSessionOf({ state, workspaceId });
  if (session === null) {
    return null;
  }
  return state.sessionExternalTasks[session.id]?.[0]?.identifier ?? null;
};

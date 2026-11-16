import type { ProjectId, Session, WorkspaceId } from '@goodboy/types';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly workspaceId: WorkspaceId;
};

const RECENT_SESSIONS_READ = 40;

export const recentProjectIdsOf = ({ sessions, workspaceId }: Params): ReadonlyArray<ProjectId> =>
  sessions
    .filter((session) => session.workspaceId === workspaceId && session.deletedAt === undefined)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, RECENT_SESSIONS_READ)
    .flatMap((session) => (session.activeProjectId === undefined ? [] : [session.activeProjectId]))
    .filter((id, index, list) => list.indexOf(id) === index);

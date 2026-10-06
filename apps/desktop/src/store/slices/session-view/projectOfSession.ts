import type { Project, Session, SessionId, SessionProjectMount } from '@goodboy/types';
import type { SessionProjectRef } from './types';

type Params = {
  readonly session: Session;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Project>;
};

const projectOfSession = ({ session, mounts, projects }: Params): SessionProjectRef | null => {
  const projectId = session.activeProjectId ?? mounts[0]?.projectId ?? null;
  if (projectId === null) {
    return null;
  }
  const project = projects.find((candidate) => candidate.id === projectId);
  return project === undefined ? null : { id: project.id, name: project.name };
};

type MapParams = {
  readonly sessions: ReadonlyArray<Session>;
  readonly mountsBySession: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>>;
  readonly projects: ReadonlyArray<Project>;
};

export const projectsBySession = ({
  sessions,
  mountsBySession,
  projects,
}: MapParams): Readonly<Record<SessionId, SessionProjectRef | null>> =>
  Object.fromEntries(
    sessions.map((session) => [
      session.id,
      projectOfSession({ session, mounts: mountsBySession[session.id] ?? [], projects }),
    ]),
  );

import type { Project, Session, SessionId, SessionProjectMount } from '@goodboy/types';
import { projectById } from '../projects/projectIndex';
import type { SessionProjectRef } from './types';

type Params = {
  readonly session: Session;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Project>;
};

const projectOfSession = ({ session, mounts, projects }: Params): SessionProjectRef | null => {
  const project = projectById(projects, session.activeProjectId ?? mounts[0]?.projectId ?? null);
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

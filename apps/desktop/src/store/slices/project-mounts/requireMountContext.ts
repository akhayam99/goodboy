import type { Project, ProjectId, Session, SessionId } from '@goodboy/types';
import { mountError } from './mountErrors';
import type { GetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';
import { projectById } from '../projects/projectIndex';

type SessionParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

type ContextParams = SessionParams & {
  readonly projectId: ProjectId;
};

export type MountContext = {
  readonly session: Session;
  readonly project: Project;
};

const requireSession = ({ get, sessionId }: SessionParams): Session => {
  const session =
    sessionById(get().sessions, sessionId) ??
    Object.values(get().archivedSessions)
      .flat()
      .find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    throw mountError({ code: 'mount-missing', message: `session not found: ${sessionId}` });
  }
  return session;
};

export const requireMountContext = ({ get, sessionId, projectId }: ContextParams): MountContext => {
  const session = requireSession({ get, sessionId });
  const project = projectById(get().projects, projectId);
  if (project === undefined || project.workspaceId !== session.workspaceId) {
    throw mountError({
      code: 'project-missing',
      message: `project not found in this workspace: ${projectId}`,
    });
  }
  return { session, project };
};

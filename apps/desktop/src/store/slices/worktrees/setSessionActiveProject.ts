import type { ProjectId, SessionId } from '@goodboy/types';
import { updateSessionActiveProject } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type Input = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

export const setSessionActiveProject = ({ set }: Params) => {
  return async ({ sessionId, projectId }: Input): Promise<void> => {
    set((state) => {
      const nextGithub = { ...state.sessionGithub };
      const nextGithubPrs = { ...state.sessionGithubPrs };
      const nextGitlab = { ...state.sessionGitlabMr };
      const nextSelectedPrNumber = { ...state.sessionSelectedPrNumber };
      delete nextGithub[sessionId];
      delete nextGithubPrs[sessionId];
      delete nextGitlab[sessionId];
      delete nextSelectedPrNumber[sessionId];
      return {
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, activeProjectId: projectId } : session,
        ),
        sessionActiveProject: { ...state.sessionActiveProject, [sessionId]: projectId },
        sessionGithub: nextGithub,
        sessionGithubPrs: nextGithubPrs,
        sessionGitlabMr: nextGitlab,
        sessionSelectedPrNumber: nextSelectedPrNumber,
      };
    });
    await updateSessionActiveProject({ db: tauriDatabase, id: sessionId, projectId });
  };
};

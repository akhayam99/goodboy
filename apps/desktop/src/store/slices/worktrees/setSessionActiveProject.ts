import type { ProjectId, SessionId } from '@goodboy/types';
import { updateSessionActiveProject } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type Input = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

export const setSessionActiveProject = ({ set, get }: Params) => {
  return async ({ sessionId, projectId }: Input): Promise<void> => {
    set((state) => {
      const nextGithub = { ...state.sessionGithub };
      const nextGitlab = { ...state.sessionGitlabMr };
      const nextSelectedPrNumber = { ...state.sessionSelectedPrNumber };
      delete nextGithub[sessionId];
      delete nextGitlab[sessionId];
      delete nextSelectedPrNumber[sessionId];
      const cachedPr = state.sessionProjectPrs[sessionId]?.[projectId]?.[0] ?? null;
      const seededGithub =
        cachedPr === null
          ? nextGithub
          : {
              ...nextGithub,
              [sessionId]: {
                pr: cachedPr,
                linkedIssues: [],
                fetchedAt: null,
                failedAt: null,
                loading: false,
                error: null,
                detail: null,
                detailFetchedAt: null,
                detailLoading: false,
                detailError: null,
              },
            };
      return {
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, activeProjectId: projectId } : session,
        ),
        sessionActiveProject: { ...state.sessionActiveProject, [sessionId]: projectId },
        sessionGithub: seededGithub,
        sessionGitlabMr: nextGitlab,
        sessionSelectedPrNumber: nextSelectedPrNumber,
      };
    });
    if (get().githubStatus?.available === true) {
      void get()
        .refreshSessionPr(sessionId, { force: true, silent: true, retries: 1 })
        .then(() => get().refreshSessionPrDetail(sessionId, { silent: true }));
    }
    await updateSessionActiveProject({ db: tauriDatabase, id: sessionId, projectId });
  };
};

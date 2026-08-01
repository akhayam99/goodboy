import type { SessionId, WorkspaceId } from '@goodboy/types';
import { updateSessionActiveMount } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type Input = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const setSessionActiveMount = ({ set }: Params) => {
  return async ({ sessionId, workspaceId }: Input): Promise<void> => {
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
          session.id === sessionId ? { ...session, activeMountWorkspaceId: workspaceId } : session,
        ),
        sessionActiveMount: { ...state.sessionActiveMount, [sessionId]: workspaceId },
        sessionGithub: nextGithub,
        sessionGithubPrs: nextGithubPrs,
        sessionGitlabMr: nextGitlab,
        sessionSelectedPrNumber: nextSelectedPrNumber,
      };
    });
    await updateSessionActiveMount({ db: tauriDatabase, id: sessionId, workspaceId });
  };
};

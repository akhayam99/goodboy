import type { Session, Workspace } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { stageInfosOf } from '../../../store/slices/session-view/stageInfosOf';
import { unpushedCommitsOf } from '../../branch/unpushedCommitsOf';
import { mobileMergeFactsOf } from '../mobileConfinement';
import { isLiveSession } from './isLiveSession';
import type { WorkspaceScope } from './workspaceScope';

export type ScopeState = AppState;

type Params = {
  readonly workspace: Pick<Workspace, 'id' | 'name'>;
  readonly state: ScopeState;
  readonly sessions: ReadonlyArray<Session>;
  readonly isFullyLoaded: boolean;
};

export const scopeOfState = ({
  workspace,
  state,
  sessions,
  isFullyLoaded,
}: Params): WorkspaceScope => {
  const live = sessions.filter((session) => isLiveSession({ session }));
  const infos = stageInfosOf({ state: { ...state, sessions: live }, sessions: live });
  const facts = Object.fromEntries(
    live.map((session) => [
      session.id,
      mobileMergeFactsOf({
        state,
        sessionId: session.id,
        unpushed: isFullyLoaded
          ? unpushedCommitsOf({ state, sessionId: session.id, mountId: null })
          : 0,
      }),
    ]),
  );
  return {
    workspace: { id: workspace.id, name: workspace.name },
    sessions: live,
    infos,
    openQuestions: state.sessionOpenQuestions,
    agents: state.sessionPhaseRuns,
    projectNames: Object.fromEntries(
      live.map((session) => [
        session.id,
        [
          ...new Set(
            (state.sessionProjectMounts[session.id] ?? []).flatMap((mount) => {
              const project = state.projects.find((candidate) => candidate.id === mount.projectId);
              return project === undefined ? [] : [project.name];
            }),
          ),
        ],
      ]),
    ),
    tasks: state.sessionExternalTasks,
    pullRequests: Object.fromEntries(
      live.map((session) => [session.id, state.sessionGithub[session.id]?.pr ?? null]),
    ),
    pullRequestFacts: facts,
    spendUsd: {},
  };
};

import type { Session, Workspace } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { stageInfosOf } from '../../../store/slices/session-view/stageInfosOf';
import { unpushedCommitsOf } from '../../branch/unpushedCommitsOf';
import { mobileMergeFactsOf } from '../mobileConfinement';
import { totalUsd } from '../../budget/spendFigures';
import { isLiveSession } from './isLiveSession';
import { pickForSessions } from './pickForSessions';
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
  const ids = live.map((session) => session.id);
  const telemetry = pickForSessions({ ids, record: state.sessionTelemetry });
  const agents = Object.values(pickForSessions({ ids, record: state.sessionPhaseRuns })).flat();
  const agentIds = agents.map((agent) => agent.id);
  return {
    workspace: { id: workspace.id, name: workspace.name },
    sessions: live,
    infos,
    openQuestions: state.sessionOpenQuestions,
    agents: pickForSessions({ ids, record: state.sessionPhaseRuns }),
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
    spendUsd: Object.fromEntries(
      Object.entries(telemetry).map(([id, records]) => [id, totalUsd({ records })]),
    ),
    telemetry,
    budgets: pickForSessions({ ids, record: state.sessionBudgets }),
    slackDrafts: pickForSessions({ ids, record: state.sessionSlackDrafts }),
    trees: pickForSessions({ ids, record: state.autoTreeViews }),
    transcripts: pickForSessions({ ids: agentIds, record: state.transcripts }),
    turnStates: pickForSessions({ ids: agentIds, record: state.agentTurnState }),
    decisions: pickForSessions({ ids, record: state.sessionDecisions }),
  };
};

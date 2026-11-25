import { DEFAULT_WORKFLOW_RULES, type Session, type Workspace } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { stageInfosOf } from '../../../store/slices/session-view/stageInfosOf';
import { unpushedCommitsOf } from '../../branch/unpushedCommitsOf';
import { mobileMergeFactsOf } from '../mobileConfinement';
import { totalUsd } from '../../budget/spendFigures';
import { readyLinesOf } from '../../board/mergeTrain/readyLinesOf';
import { readyCarsOf } from '../../board/mergeTrain/readyCarsOf';
import { readyToMergeOf } from '../../board/mergeTrain/readyToMergeOf';
import { requestChecksOf } from '../../board/mergeTrain/requestChecksOf';
import { sessionTitle } from '../../../shared/utils/sessionTitle';
import { pullRequestViewOf } from '../../../store/slices/pull-request-view/pullRequestViewOf';
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

type ReadyParams = {
  readonly state: ScopeState;
  readonly live: ReadonlyArray<Session>;
  readonly infos: ReturnType<typeof stageInfosOf>;
};

type TrainParams = {
  readonly train: ScopeState['mergeTrain'];
  readonly ids: ReadonlyArray<string>;
};

const trainOf = ({ train, ids }: TrainParams): WorkspaceScope['mergeTrain'] =>
  train !== null && train.cars.some((car) => ids.includes(car.sessionId)) ? train : null;

const readyLinesIn = ({ state, live, infos }: ReadyParams): WorkspaceScope['readyLines'] => {
  const numbers: Record<string, number> = {};
  const checks: Record<string, ReturnType<typeof requestChecksOf>> = {};
  for (const session of live) {
    const number = state.sessionGithub[session.id]?.pr?.number;
    if (number !== undefined) {
      numbers[session.id] = number;
    }
    checks[session.id] = requestChecksOf({ state, sessionId: session.id });
  }
  const rows = readyToMergeOf({ sessions: live, infos, numbers, checks });
  const cars = readyCarsOf({ state, rows });
  const titles = new Map(live.map((session) => [session.id, sessionTitle({ session })]));
  const heads = new Map<string, string | null | undefined>(
    live.map((session) => [session.id, state.sessionGithub[session.id]?.pr?.headSha]),
  );
  return readyLinesOf({ rows, cars, sessionTitles: titles }).flatMap((line) => {
    const headSha = heads.get(line.sessionId) ?? null;
    if (line.car === null || line.number === null || headSha === null) {
      return [];
    }
    return [
      {
        sessionId: line.sessionId,
        prNumber: line.number,
        headSha,
        title: line.title,
        repo: line.car.repo,
        reason: line.reason,
      },
    ];
  });
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
    readyLines: readyLinesIn({ state, live, infos }),
    mergeTrain: trainOf({ train: state.mergeTrain, ids }),
    fileCounts: Object.fromEntries(
      live.map((session) => {
        const fact = facts[session.id];
        return [
          session.id,
          fact === undefined || fact.number === null
            ? null
            : (pullRequestViewOf({
                state,
                sessionId: session.id,
                mountId: fact.mountId,
                prNumber: fact.number,
              })?.view?.files.count ?? null),
        ];
      }),
    ),
    presets: (state.phaseTemplates[workspace.id] ?? [])
      .filter((workflow) => workflow.isPreset === true && workflow.deletedAt == null)
      .map((workflow) => ({ id: workflow.id, name: workflow.name })),
    projects: state.projects
      .filter((project) => project.workspaceId === workspace.id)
      .map((project) => ({ id: project.id, name: project.name })),
    defaultLimitUsd: (
      state.workspaceOverrides[workspace.id]?.workflowRules ?? DEFAULT_WORKFLOW_RULES
    ).spendLimitUsd,
  };
};

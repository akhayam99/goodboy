import type { Agent, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { latestStampMs } from './latestStampMs';

export type InactivityInputsState = Pick<
  AppState,
  | 'sessionPhaseRuns'
  | 'agentDraft'
  | 'agentQueue'
  | 'sessionGithub'
  | 'mountGithub'
  | 'sessionGitlabMr'
  | 'mountGitlabMr'
> & {
  readonly sessionProjectMounts: AppState['sessionProjectMounts'] | undefined;
};

export type InactivityInputs = {
  readonly seenActivityAt: number | null;
  readonly isQueued: boolean;
  readonly hasDraft: boolean;
};

type Params = {
  readonly state: InactivityInputsState;
  readonly sessionId: SessionId;
};

type AgentParams = {
  readonly agent: Agent;
};

const agentStampsOf = ({ agent }: AgentParams): ReadonlyArray<string | undefined> => [
  agent.startedAt,
  agent.lastFinishedAt,
  agent.completedAt,
  agent.stoppedAt,
  agent.doneAt,
  agent.lastViewedAt,
];

export const inactivityInputsOf = ({ state, sessionId }: Params): InactivityInputs => {
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const mounts = state.sessionProjectMounts?.[sessionId] ?? [];
  const sessionPr = state.sessionGithub[sessionId]?.pr ?? null;
  const mountPrs = mounts.flatMap((mount) => state.mountGithub[mount.mountId]?.prs ?? []);
  const prs = sessionPr === null ? mountPrs : [sessionPr, ...mountPrs];
  const sessionMr = state.sessionGitlabMr[sessionId]?.mr ?? null;
  const mountMrs = mounts.flatMap((mount) => state.mountGitlabMr[mount.mountId]?.mrs ?? []);
  const mrs = sessionMr === null ? mountMrs : [sessionMr, ...mountMrs];
  return {
    seenActivityAt: latestStampMs({
      stamps: [
        ...agents.flatMap((agent) => agentStampsOf({ agent })),
        ...prs.flatMap((pr) => [pr.updatedAt, pr.mergedAt]),
        ...mrs.flatMap((mr) => [mr.updatedAt, mr.mergedAt]),
      ],
    }),
    isQueued: agents.some((agent) => (state.agentQueue[agent.id] ?? []).length > 0),
    hasDraft: agents.some((agent) => (state.agentDraft[agent.id] ?? '').trim().length > 0),
  };
};

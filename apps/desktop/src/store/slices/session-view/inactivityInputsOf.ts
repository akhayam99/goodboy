import type { Agent, PullRequestStateKind, SessionId } from '@goodboy/types';
import { classifyAgent, type AgentKind } from '../../../features/session/agent-kind';
import { gitlabMrStateKind } from '../../../features/integrations/gitlab/gitlabMrStateKind';
import type { AppState } from '../../types';
import { latestStampMs } from './latestStampMs';
import { requestsOfSession } from './requestsOfSession';

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
  readonly requestEndedAt: number | null;
  readonly personTurnAt: number | null;
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

const ENDED_STATES: ReadonlyArray<PullRequestStateKind> = ['merged', 'closed'];

const BACKGROUND_KINDS: ReadonlyArray<AgentKind> = [
  'resolver',
  'rewriter',
  'scribe',
  'ci-debugger',
  'ci-fixer',
  'auto',
];

const isConversationAgent = ({ agent }: AgentParams): boolean =>
  agent.parentAgentId == null &&
  agent.workflowRunId == null &&
  !BACKGROUND_KINDS.includes(classifyAgent({ agent, override: null }));

const turnStampsOf = ({ agent }: AgentParams): ReadonlyArray<string | undefined> => [
  agent.startedAt,
  agent.lastFinishedAt,
  agent.completedAt,
  agent.stoppedAt,
];

export const inactivityInputsOf = ({ state, sessionId }: Params): InactivityInputs => {
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const { prs, mrs } = requestsOfSession({ state, sessionId });
  return {
    seenActivityAt: latestStampMs({
      stamps: [
        ...agents.flatMap((agent) => agentStampsOf({ agent })),
        ...prs.flatMap((pr) => [pr.updatedAt, pr.mergedAt]),
        ...mrs.flatMap((mr) => [mr.updatedAt, mr.mergedAt]),
      ],
    }),
    requestEndedAt: latestStampMs({
      stamps: [
        ...prs
          .filter((pr) => ENDED_STATES.includes(pr.state))
          .map((pr) => pr.mergedAt ?? pr.updatedAt),
        ...mrs
          .filter((mr) => ENDED_STATES.includes(gitlabMrStateKind({ mr })))
          .map((mr) => mr.mergedAt ?? mr.updatedAt),
      ],
    }),
    personTurnAt: latestStampMs({
      stamps: agents
        .filter((agent) => isConversationAgent({ agent }))
        .flatMap((agent) => turnStampsOf({ agent })),
    }),
    isQueued: agents.some((agent) => (state.agentQueue[agent.id] ?? []).length > 0),
    hasDraft: agents.some((agent) => (state.agentDraft[agent.id] ?? '').trim().length > 0),
  };
};

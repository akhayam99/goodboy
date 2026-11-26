import type { Agent, Session } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import { otherAttentionLinesOf, SESSION_STAGE_META } from '../../session/session-stage';
import { sessionMarkOf } from '../../session/sessionMarkOf';
import { sessionNodeOf } from '../../session/sessionNode';
import type { SessionFact, SessionFields, SessionLine } from '../contract/projections';
import { agentMarkOf } from './agentMarkOf';
import { agentStateOf } from './agentStateOf';
import { needsYouFieldsOf } from './needsYouFieldsOf';
import { sessionRefOf } from './sessionRefOf';
import type { WorkspaceScope } from './workspaceScope';

export const ACTIVITY_LIMIT = 20;

type Params = {
  readonly scope: WorkspaceScope;
  readonly session: Session;
  readonly now: number;
};

type LineParams = {
  readonly agent: Agent;
};

const lineOf = ({ agent }: LineParams): SessionLine => ({
  id: agent.id,
  mark: agentMarkOf({ state: agentStateOf({ status: agent.status }) }),
  text: agent.outputSummary === undefined ? agent.name : `${agent.name}: ${agent.outputSummary}`,
  at: agent.completedAt ?? agent.startedAt ?? null,
});

const isOpenAgent = ({ agent }: LineParams): boolean =>
  agent.status === 'running' || agent.status === 'blocked';

type RecentParams = {
  readonly left: SessionLine;
  readonly right: SessionLine;
};

const byRecent = ({ left, right }: RecentParams): number => {
  const l = left.at ?? '';
  const r = right.at ?? '';
  return l < r ? 1 : l > r ? -1 : 0;
};

export const sessionFieldsOf = ({ scope, session, now }: Params): SessionFields | null => {
  const info = scope.infos[session.id];
  if (info === undefined) {
    return null;
  }
  const node = sessionNodeOf({ info, isArchived: false });
  const agents = scope.agents[session.id] ?? [];
  const spend = scope.spendUsd[session.id];
  const pr = scope.pullRequests[session.id] ?? null;
  const facts: ReadonlyArray<SessionFact> = [
    { label: 'Stage', value: SESSION_STAGE_META[info.stage].label },
    ...(spend === undefined ? [] : [{ label: 'Spend', value: formatUsd(spend) }]),
    ...(pr === null ? [] : [{ label: 'Pull request', value: `#${pr.number}` }]),
  ];
  const needsYou = needsYouFieldsOf({
    scopes: [{ ...scope, sessions: [session] }],
    now,
  }).rows;
  return {
    workspaceId: scope.workspace.id,
    sessionId: session.id,
    ref: sessionRefOf({ tasks: scope.tasks[session.id] }),
    goal: session.goal,
    stage: info.stage,
    mark: sessionMarkOf({ node }),
    facts,
    notices: otherAttentionLinesOf({ info }).map((line) => ({
      id: `${session.id}:${line.reason}`,
      tone: line.tone,
      text: line.words,
      isMacOnly: true,
    })),
    needsYou,
    now: agents.filter((agent) => isOpenAgent({ agent })).map((agent) => lineOf({ agent })),
    next: [],
    projects: (scope.projectNames[session.id] ?? []).map((name) => ({
      name,
      branch: pr === null ? null : pr.headBranch,
      prNumber: pr === null ? null : pr.number,
    })),
    activity: agents
      .filter((agent) => !isOpenAgent({ agent }))
      .map((agent) => lineOf({ agent }))
      .sort((left, right) => byRecent({ left, right }))
      .slice(0, ACTIVITY_LIMIT),
    pullRequestNumber: pr === null ? null : pr.number,
  };
};

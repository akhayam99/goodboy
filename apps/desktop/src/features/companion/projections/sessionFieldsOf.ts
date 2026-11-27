import type { Agent, Session } from '@goodboy/types';
import { stripControlMarkers } from '@goodboy/core/context';
import { agentEndOf } from './agentEndOf';
import { formatUsd } from '@goodboy/ui';
import { formatSpan } from '../../../shared/utils/time/formatSpan';
import { otherAttentionLinesOf, SESSION_STAGE_META } from '../../session/session-stage';
import { sessionMarkOf } from '../../session/sessionMarkOf';
import { sessionNodeOf } from '../../session/sessionNode';
import type { SessionFact, SessionFields, SessionLine } from '../contract/projections';
import { agentMarkOf } from './agentMarkOf';
import { ARTIFACT_LIMIT, artifactRowsOf } from './artifactRowsOf';
import { agentRoleOf } from './agentRoleOf';
import { agentStateOf } from './agentStateOf';
import { isLeadAgentOf } from './isLeadAgentOf';
import { needsYouFieldsOf } from './needsYouFieldsOf';
import { nextLinesOf } from './nextLinesOf';
import { prStateOf } from './prStateOf';
import { openQuestionCountOf, questionRowsOf } from './questionRowsOf';
import { safeTextOf } from './safeTextOf';
import { sessionRefOf } from './sessionRefOf';
import { shortNameOf } from './shortNameOf';
import type { WorkspaceScope } from './workspaceScope';

export const ACTIVITY_LIMIT = 20;
export const DECISION_LIMIT = 12;

const LINE_TITLE_MAX = 80;
const LINE_SUMMARY_MAX = 240;

const NO_CHIPS = { spendToday: null, limits: [] } as const;

type Params = {
  readonly scope: WorkspaceScope;
  readonly session: Session;
  readonly now: number;
};

type LineParams = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
  readonly agent: Agent;
};

const lineOf = ({ scope, sessionId, agent }: LineParams): SessionLine => {
  const state = agentStateOf({ agent, turn: scope.turnStates[agent.id] });
  const isLead = isLeadAgentOf({ scope, sessionId, agent });
  const summary = stripControlMarkers(agent.outputSummary ?? '');
  return {
    id: agent.id,
    mark: agentMarkOf({ state }),
    text: summary === '' ? agent.name : `${agent.name}: ${summary}`,
    at: agent.completedAt ?? agent.startedAt ?? null,
    role: agentRoleOf({ agent, isLead }),
    target: { kind: 'agent', id: agent.id },
    title: safeTextOf({ text: agent.name, max: LINE_TITLE_MAX }),
    ...(summary === '' ? {} : { summary: safeTextOf({ text: summary, max: LINE_SUMMARY_MAX }) }),
  };
};

type OpenParams = {
  readonly agent: Agent;
};

const isOpenAgent = ({ agent }: OpenParams): boolean =>
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
  const agentMillis = agents.reduce((sum, agent) => {
    if (agent.startedAt === undefined) {
      return sum;
    }
    const span = Date.parse(agentEndOf({ agent, now })) - Date.parse(agent.startedAt);
    return Number.isNaN(span) ? sum : sum + Math.max(0, span);
  }, 0);
  const agentTime = agentMillis === 0 ? '' : formatSpan({ from: 0, to: agentMillis });
  const facts: ReadonlyArray<SessionFact> = [
    { label: 'Stage', value: SESSION_STAGE_META[info.stage].label },
    ...(spend === undefined ? [] : [{ label: 'Spend', value: formatUsd(spend) }]),
    ...(agentTime === '' ? [] : [{ label: 'Agent time', value: agentTime }]),
    ...(pr === null ? [] : [{ label: 'Pull request', value: `#${pr.number}` }]),
  ];
  const needsYou = needsYouFieldsOf({
    scopes: [{ ...scope, sessions: [session] }],
    workspaces: [scope.workspace],
    chips: NO_CHIPS,
    now,
  }).rows;
  const artifacts = artifactRowsOf({ scope, sessionId: session.id });
  const questions = questionRowsOf({ scope, sessionId: session.id });
  const runCount = session.workflowRuns.filter((run) => run.discardedAt == null).length;
  const stats = scope.lineStats[session.id] ?? null;
  const prWord = prStateOf({ pr });
  return {
    workspaceId: scope.workspace.id,
    sessionId: session.id,
    ref: sessionRefOf({ tasks: scope.tasks[session.id] }),
    goal: session.goal,
    shortName: shortNameOf({ goal: session.goal }),
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
    now: agents
      .filter((agent) => isOpenAgent({ agent }))
      .map((agent) => lineOf({ scope, sessionId: session.id, agent })),
    next: nextLinesOf({ scope, session }),
    projects: (scope.projectNames[session.id] ?? []).map((name) => ({
      name,
      branch: pr === null ? null : pr.headBranch,
      prNumber: pr === null ? null : pr.number,
      prState: prWord.word,
      prTone: prWord.tone,
      additions: stats === null ? null : stats.additions,
      deletions: stats === null ? null : stats.deletions,
      runCount,
    })),
    activity: agents
      .filter((agent) => !isOpenAgent({ agent }))
      .map((agent) => lineOf({ scope, sessionId: session.id, agent }))
      .sort((left, right) => byRecent({ left, right }))
      .slice(0, ACTIVITY_LIMIT),
    pullRequestNumber: pr === null ? null : pr.number,
    decisions: (scope.decisions[session.id] ?? [])
      .filter((decision) => decision.status === 'active')
      .slice(0, DECISION_LIMIT)
      .map((decision) => safeTextOf({ text: decision.text, max: 240 })),
    summary: scope.summaries[session.id] ?? null,
    artifacts: artifacts.slice(0, ARTIFACT_LIMIT),
    questions,
    counts: {
      runs: runCount,
      artifacts: artifacts.length,
      openQuestions: openQuestionCountOf({ scope, sessionId: session.id }),
    },
  };
};

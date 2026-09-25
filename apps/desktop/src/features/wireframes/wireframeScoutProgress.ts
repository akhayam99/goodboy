import type { Agent, AgentId } from '@goodboy/types';
import {
  WIREFRAME_SCOUT_DEADLINE_REASON,
  WIREFRAME_SCOUT_RESTART_REASON,
} from './wireframeScoutReports';

export const WIREFRAME_SCOUT_STOP_REASON = 'you stopped this wireframe';

const SHORT_REASON: Readonly<Record<string, string>> = {
  [WIREFRAME_SCOUT_DEADLINE_REASON]: 'deadline',
  [WIREFRAME_SCOUT_RESTART_REASON]: 'app restart',
  [WIREFRAME_SCOUT_STOP_REASON]: 'stopped',
};

export type WireframeScoutVerification = Readonly<{
  verified: number;
  cited: number;
}>;

export type WireframeScoutProgressState = 'queued' | 'running' | 'done' | 'skipped' | 'failed';

export type WireframeScoutProgress = Readonly<{
  agentId: AgentId;
  name: string;
  state: WireframeScoutProgressState;
  detail: string | null;
  claims: string | null;
}>;

const stateOf = ({
  agent,
  isRunning,
}: Readonly<{ agent: Agent; isRunning: boolean }>): WireframeScoutProgressState => {
  if (agent.status === 'completed') {
    return 'done';
  }
  if (agent.status === 'failed') {
    return 'failed';
  }
  if (agent.status === 'skipped') {
    return 'skipped';
  }
  return isRunning ? 'running' : 'queued';
};

const elapsedLabel = ({ agent }: Readonly<{ agent: Agent }>): string | null => {
  const startedAt = agent.startedAt ?? null;
  const finishedAt = agent.completedAt ?? agent.lastFinishedAt ?? null;
  if (startedAt === null || finishedAt === null) {
    return null;
  }
  const seconds = Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1_000);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
};

const SKIP_DETAIL_LIMIT = 60;

const skipDetail = ({ agent }: Readonly<{ agent: Agent }>): string | null => {
  const summary = agent.outputSummary?.trim() ?? '';
  if (summary.length === 0) {
    return null;
  }
  const short = SHORT_REASON[summary];
  if (short !== undefined) {
    return short;
  }
  return summary.length <= SKIP_DETAIL_LIMIT
    ? summary
    : `${summary.slice(0, SKIP_DETAIL_LIMIT)}...`;
};

type Params = Readonly<{
  container: Agent;
  agents: ReadonlyArray<Agent>;
  runningAgentIds: ReadonlySet<AgentId>;
  verifications: Readonly<Record<string, WireframeScoutVerification>>;
}>;

export const wireframeScoutProgress = ({
  container,
  agents,
  runningAgentIds,
  verifications,
}: Params): ReadonlyArray<WireframeScoutProgress> =>
  agents
    .filter((agent) => agent.parentAgentId === container.id && agent.deletedAt == null)
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((agent) => {
      const state = stateOf({ agent, isRunning: runningAgentIds.has(agent.id) });
      const verification = verifications[agent.id] ?? null;
      return {
        agentId: agent.id,
        name: agent.name,
        state,
        detail: state === 'done' ? elapsedLabel({ agent }) : skipDetail({ agent }),
        claims:
          verification === null || verification.cited === 0
            ? null
            : `${verification.verified} of ${verification.cited} claims verified`,
      };
    });

export const hasLiveWireframeScout = ({
  scouts,
}: Readonly<{ scouts: ReadonlyArray<WireframeScoutProgress> }>): boolean =>
  scouts.some((scout) => scout.state === 'queued' || scout.state === 'running');

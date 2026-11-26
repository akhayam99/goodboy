import { formatUsd } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';
import { formatSpan } from '../../../shared/utils/time/formatSpan';
import type { WorkspaceScope } from './workspaceScope';

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
  readonly agent: Agent;
  readonly now: number;
};

export type AgentFacts = {
  readonly model: string | null;
  readonly spendText: string | null;
  readonly timeText: string | null;
};

export const agentFactsOf = ({ scope, sessionId, agent, now }: Params): AgentFacts => {
  const records =
    agent.runId === undefined
      ? []
      : (scope.telemetry[sessionId] ?? []).filter((record) => record.runId === agent.runId);
  const latest = records.at(-1);
  const spend = records.reduce((sum, record) => sum + record.estimatedCostUsd, 0);
  const span =
    agent.startedAt === undefined
      ? ''
      : formatSpan({ from: agent.startedAt, to: agent.completedAt ?? now });
  return {
    model: agent.modelOverride ?? latest?.model ?? null,
    spendText: records.length === 0 ? null : formatUsd(spend),
    timeText: span === '' ? null : span,
  };
};

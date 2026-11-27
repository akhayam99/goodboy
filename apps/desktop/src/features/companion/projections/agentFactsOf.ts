import { formatUsd } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';
import { formatSpan } from '../../../shared/utils/time/formatSpan';
import { agentOwnSpendById } from '../../session/timeline/agentOwnSpendById';
import { agentEndOf } from './agentEndOf';
import { agentRunIdsOf } from './agentRunIdsOf';
import type { WorkspaceScope } from './workspaceScope';

type Params = {
  readonly scope: Pick<WorkspaceScope, 'telemetry' | 'agentRunHistory'>;
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
  const runIds = agentRunIdsOf({ scope, agent });
  const records = (scope.telemetry[sessionId] ?? []).filter((record) => runIds.has(record.runId));
  const latest = records.at(-1);
  const hasSpend = records.some((record) => record.kind !== 'summarizer');
  const spend =
    agentOwnSpendById({
      records,
      agents: [agent],
      agentRunHistory: scope.agentRunHistory ?? {},
    }).get(agent.id) ?? 0;
  const span =
    agent.startedAt === undefined
      ? ''
      : formatSpan({ from: agent.startedAt, to: agentEndOf({ agent, now }) });
  return {
    model: agent.modelOverride ?? latest?.model ?? null,
    spendText: hasSpend ? formatUsd(spend) : null,
    timeText: span === '' ? null : span,
  };
};

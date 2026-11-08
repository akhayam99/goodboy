import type { ReactNode } from 'react';
import type { Agent, AgentId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../../../../store';
import { useNow } from '../../../../../../../shared/hooks/useNow';
import { useAgentMetrics } from '../../../../../hooks/useAgentMetrics';
import type { SessionRun } from '../../../../../sessionRunsOf';
import { RunsGridAgentRow } from '../RunsGridAgentRow';
import { RunsGridRow } from '../RunsGridRow';
import { useRunVerbPress } from '../useRunVerbPress';

type OpenParams = {
  readonly run: SessionRun;
  readonly rowKey: string;
};

export type RunRowRenderParams = OpenParams & {
  readonly titleSuffix: ReactNode;
};

type Params = {
  readonly session: Session;
  readonly onOpen: (params: OpenParams) => void;
};

type AgentParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly agentId: AgentId;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const agentOf = ({ agents, agentId }: AgentParams): Agent | null =>
  agents.find((candidate) => candidate.id === agentId) ?? null;

export const useRunRowRender = ({ session, onOpen }: Params) => {
  const sessionId = session.id;
  const now = useNow(30_000);
  const verbPress = useRunVerbPress({ sessionId });
  const { aggregatesByAgentId } = useAgentMetrics({ sessionId });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);

  return ({ run, rowKey, titleSuffix }: RunRowRenderParams): ReactNode => {
    const aggregates = run.agentIds.map((agentId) => aggregatesByAgentId.get(agentId));
    const isCostTracked = aggregates.some((aggregate) => (aggregate?.turns ?? 0) > 0);
    const agent =
      run.shape === 'lead' && run.open.kind !== 'run'
        ? agentOf({ agents, agentId: run.open.agentId })
        : null;
    const costUsd = isCostTracked
      ? aggregates.reduce((total, aggregate) => total + (aggregate?.estimatedCostUsd ?? 0), 0)
      : null;
    if (agent === null) {
      return (
        <RunsGridRow
          key={rowKey}
          session={session}
          run={run}
          rowKey={rowKey}
          modelLine={null}
          costUsd={costUsd}
          titleSuffix={titleSuffix}
          now={now}
          isVerbBusy={verbPress.isBusy({ run })}
          onOpen={() => onOpen({ run, rowKey })}
          onVerb={() => verbPress.press({ run })}
        />
      );
    }
    return (
      <RunsGridAgentRow
        key={rowKey}
        session={session}
        run={run}
        rowKey={rowKey}
        agent={agent}
        costUsd={costUsd}
        titleSuffix={titleSuffix}
        now={now}
        isVerbBusy={verbPress.isBusy({ run })}
        onOpen={() => onOpen({ run, rowKey })}
        onVerb={() => verbPress.press({ run })}
      />
    );
  };
};

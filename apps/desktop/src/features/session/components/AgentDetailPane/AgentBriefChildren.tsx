import { SectionSurface } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';
import type { AgentKind } from '../../agent-kind';
import { useAppStore } from '../../../../store';
import { AgentBriefChildRow } from './AgentBriefChildRow';

type Props = {
  readonly session: Session;
  readonly kind: AgentKind;
  readonly children: ReadonlyArray<SpawnedChild>;
};

export const AgentBriefChildren = ({ session, kind, children }: Props) => {
  const selectAgent = useAppStore((state) => state.selectAgent);
  const metrics = useAgentMetrics({ sessionId: session.id });
  if (children.length === 0 || kind === 'planner') {
    return null;
  }
  const isClusters = kind === 'implementer';
  const done = children.filter((child) => child.status === 'completed').length;
  const onSelect = (agentId: AgentId) => {
    void selectAgent(session.id, agentId);
  };
  return (
    <SectionSurface
      label={isClusters ? 'Clusters' : 'Agents'}
      action={
        <span className="text-2xs tabular-nums text-muted-foreground">
          {isClusters ? `${done}/${children.length}` : String(children.length)}
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        {children.map((child) => (
          <AgentBriefChildRow
            key={child.agent.id}
            child={child}
            costUsd={metrics.aggregatesByAgentId.get(child.agent.id)?.estimatedCostUsd ?? 0}
            onSelect={onSelect}
          />
        ))}
      </div>
    </SectionSurface>
  );
};

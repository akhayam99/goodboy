import { SectionSurface, StatusDot, formatUsd } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';
import type { AgentKind } from '../../agent-kind';
import { useAppStore } from '../../../../store';

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
        {children.map((child) => {
          const cost = metrics.aggregatesByAgentId.get(child.agent.id)?.estimatedCostUsd ?? 0;
          return (
            <button
              key={child.agent.id}
              type="button"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-elevated"
              onClick={() => onSelect(child.agent.id)}
            >
              <StatusDot
                tone={
                  child.status === 'failed'
                    ? 'danger'
                    : child.status === 'running'
                      ? 'info'
                      : child.status === 'completed'
                        ? 'success'
                        : 'neutral'
                }
                size="sm"
                pulsing={child.status === 'running'}
              />
              <span className="w-5 shrink-0 text-2xs tabular-nums text-muted-foreground">
                {child.index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {child.agent.name}
              </span>
              {cost > 0 ? (
                <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                  {formatUsd(cost)}
                </span>
              ) : null}
              <span
                className={
                  child.status === 'failed'
                    ? 'shrink-0 text-2xs text-danger'
                    : 'shrink-0 text-2xs text-muted-foreground'
                }
              >
                {child.status === 'pending' ? 'queued' : child.status}
              </span>
            </button>
          );
        })}
      </div>
    </SectionSurface>
  );
};

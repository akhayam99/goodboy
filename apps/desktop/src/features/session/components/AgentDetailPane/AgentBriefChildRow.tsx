import { StatusDot, formatUsd } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { useAppStore, useExecutedAgentRouting } from '../../../../store';

type Props = {
  readonly child: SpawnedChild;
  readonly costUsd: number;
  readonly onSelect: (agentId: AgentId) => void;
};

export const AgentBriefChildRow = ({ child, costUsd, onSelect }: Props) => {
  const { agent, status } = child;
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null,
  );
  const modelOverride = useAppStore(
    (state) => state.agentModelOverride[agent.id] ?? agent.modelOverride ?? null,
  );
  const effortOverride = useAppStore(
    (state) => state.agentEffortOverride[agent.id] ?? agent.effort ?? null,
  );
  const executed = useExecutedAgentRouting({ agent });
  const model = executed?.model ?? modelOverride;
  const planned =
    modelOverride != null || providerOverride != null
      ? { provider: providerOverride, model: modelOverride }
      : null;
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-elevated"
      onClick={() => onSelect(agent.id)}
    >
      <StatusDot
        tone={
          status === 'failed'
            ? 'danger'
            : status === 'running'
              ? 'info'
              : status === 'completed'
                ? 'success'
                : 'neutral'
        }
        size="sm"
        pulsing={status === 'running'}
      />
      <span className="w-5 shrink-0 text-3xs tabular-nums text-muted-foreground">
        {child.index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs leading-4 text-foreground">
        {agent.name}
      </span>
      {model != null && (
        <RoutingBadge
          provider={executed?.provider ?? providerOverride}
          model={model}
          effort={effortOverride}
          planned={planned}
          glyphPlacement="trailing"
          className="max-w-40 shrink-0"
        />
      )}
      {costUsd > 0 && (
        <span className="shrink-0 text-3xs tabular-nums text-muted-foreground">
          {formatUsd(costUsd)}
        </span>
      )}
      <span
        className={
          status === 'failed'
            ? 'shrink-0 text-2xs text-danger'
            : 'shrink-0 text-2xs text-muted-foreground'
        }
      >
        {status === 'pending' ? 'queued' : status}
      </span>
    </button>
  );
};

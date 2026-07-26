import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Agent, AgentId } from '@goodboy/types';
import type { AgentAggregate } from '../../../../../features/session/components/AgentMetricsBlock';
import { ClusterChildRow } from './ClusterChildRow';

type Props = {
  readonly run: Agent;
  readonly children: ReadonlyArray<Agent>;
  readonly isExpanded: boolean;
  readonly unreadCount: number;
  readonly aggregatesByAgentId: ReadonlyMap<string, AgentAggregate>;
  readonly selectedAgentId: AgentId | null;
  readonly isTaskActive: boolean;
  readonly onToggle: () => void;
  readonly onSelect: (id: AgentId) => void;
};

export const WorkflowStepRuns = ({
  run,
  children,
  isExpanded,
  unreadCount,
  aggregatesByAgentId,
  selectedAgentId,
  isTaskActive,
  onToggle,
  onSelect,
}: Props) => {
  const doneCount = children.filter(
    (child) => child.status === 'completed' || child.status === 'skipped',
  ).length;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'collapse' : 'expand'} runs for ${run.name}`}
        className="flex items-center gap-1 self-start rounded text-2xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {isExpanded ? (
          <ChevronDown size={11} aria-hidden className="shrink-0" />
        ) : (
          <ChevronRight size={11} aria-hidden className="shrink-0" />
        )}
        <span className="min-w-0 truncate">
          Runs ({doneCount}/{children.length})
        </span>
        {!isExpanded && unreadCount > 0 ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded bg-warning/15 px-1 py-0.5 text-[9px] font-medium text-warning"
            title={`${unreadCount} run ${unreadCount === 1 ? 'reply' : 'replies'} to review`}
          >
            <span aria-hidden className="size-1 rounded-full bg-warning" />
            {unreadCount}
          </span>
        ) : null}
      </button>
      {isExpanded
        ? children.map((child, index) => (
            <ClusterChildRow
              key={child.id}
              child={child}
              index={index}
              total={children.length}
              costUsd={aggregatesByAgentId.get(child.id)?.estimatedCostUsd ?? 0}
              isSelected={child.id === selectedAgentId}
              isTaskActive={isTaskActive}
              onSelect={() => onSelect(child.id)}
            />
          ))
        : null}
    </div>
  );
};

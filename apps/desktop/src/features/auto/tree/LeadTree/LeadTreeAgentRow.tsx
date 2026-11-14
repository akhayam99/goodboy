import { memo } from 'react';
import type { AgentId } from '@goodboy/types';
import { cn, formatUsd } from '@goodboy/ui';
import { DelegationClock } from '../../chat/DelegationClock';
import { leadTreeIndentOf } from './leadTreeIndentOf';
import { LeadTreeDot } from './LeadTreeDot';

type Props = {
  readonly id: string;
  readonly agentId: AgentId;
  readonly depth: number;
  readonly number: string;
  readonly role: string;
  readonly title: string;
  readonly isSettled: boolean;
  readonly spendUsd: number;
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly isCompact: boolean;
  readonly onSelect: (agentId: AgentId) => void;
};

export const LeadTreeAgentRow = memo(
  ({
    id,
    agentId,
    depth,
    number,
    role,
    title,
    isSettled,
    spendUsd,
    isSelected,
    isActive,
    isCompact,
    onSelect,
  }: Props) => (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-selected={isSelected}
      aria-label={`${number} ${role}${title === '' ? '' : `, ${title}`}`}
      data-lead-tree-id={id}
      data-lead-tree-agent={agentId}
      data-active={isActive}
      className={cn(
        'flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-hover',
        isSelected && 'bg-selected',
        isActive && 'ring-1 ring-focus-ring',
      )}
      style={leadTreeIndentOf({ depth })}
      onClick={() => onSelect(agentId)}
    >
      {isCompact ? null : (
        <span className="w-6 shrink-0 text-right text-chip tabular-nums text-faint-foreground">
          {number}
        </span>
      )}
      <LeadTreeDot isSettled={isSettled} />
      <span className="shrink-0 text-ui text-foreground">{role}</span>
      {isCompact ? (
        <span className="flex-1" />
      ) : (
        <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">{title}</span>
      )}
      {isSettled ? (
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
          {formatUsd(spendUsd)}
        </span>
      ) : (
        <DelegationClock agentId={agentId} isLive />
      )}
    </div>
  ),
);

LeadTreeAgentRow.displayName = 'LeadTreeAgentRow';

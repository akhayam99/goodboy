import { memo } from 'react';
import type { AgentId } from '@goodboy/types';
import { Tooltip, WorkNode, cn, formatUsd, type WorkNodeState } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../agent-kind';
import type { RailRow } from '../../../workTreeModel/railGeometry';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { SpawnedRailCell } from '../SessionWorkspace/parts/TimelinePane/SpawnedRailCell';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_QUIET_NODES } from './leadTreeQuietNodes';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly agentId: AgentId;
  readonly number: string;
  readonly kind: AgentKind;
  readonly role: string;
  readonly title: string;
  readonly node: WorkNodeState;
  readonly word: string;
  readonly isSettled: boolean;
  readonly spendUsd: number;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly isCompact: boolean;
  readonly onSelect: (agentId: AgentId) => void;
};

export const LeadTreeAgentRow = memo(
  ({
    id,
    agentId,
    number,
    kind,
    role,
    title,
    node,
    word,
    isSettled,
    spendUsd,
    rail,
    railWidth,
    isSelected,
    isActive,
    isCompact,
    onSelect,
  }: Props) => {
    const isWordShown = !LEAD_TREE_QUIET_NODES.has(node);
    return (
      <div
        role="treeitem"
        tabIndex={-1}
        aria-selected={isSelected}
        aria-label={`${number} ${role}${title === '' ? '' : `, ${title}`}, ${word}`}
        data-lead-tree-id={id}
        data-lead-tree-agent={agentId}
        data-lead-tree-node={node}
        data-active={isActive}
        className={cn(
          LEAD_TREE_ROW,
          'cursor-pointer hover:bg-hover',
          isSelected && 'bg-selected',
          isActive && LEAD_TREE_CURSOR,
        )}
        onClick={() => onSelect(agentId)}
      >
        <SpawnedRailCell
          rail={rail}
          width={railWidth}
          marker={<WorkNode state={node} label={word} mark={{ kind: 'dot' }} size="sm" />}
        />
        {isCompact ? null : (
          <span className="shrink-0 text-chip tabular-nums text-faint-foreground">{number}</span>
        )}
        <AgentKindChip kind={kind} density="glyph" isDecorative />
        <span className="shrink-0 text-ui text-foreground">{role}</span>
        {isCompact || title === '' ? (
          <span className="flex-1" />
        ) : (
          <Tooltip content={title} anchorClassName="flex min-w-0 flex-1">
            <span
              data-lead-tree-title=""
              className="min-w-0 flex-1 truncate text-meta text-muted-foreground"
            >
              {title}
            </span>
          </Tooltip>
        )}
        {isWordShown ? (
          <span className="shrink-0 text-meta text-muted-foreground">{word}</span>
        ) : null}
        <span className="flex shrink-0 justify-end text-meta tabular-nums text-faint-foreground">
          {isSettled ? formatUsd(spendUsd) : <DelegationClock agentId={agentId} isLive />}
        </span>
      </div>
    );
  },
);

LeadTreeAgentRow.displayName = 'LeadTreeAgentRow';

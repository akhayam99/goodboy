import { memo } from 'react';
import type { AgentId } from '@goodboy/types';
import { cn, formatUsd, type WorkNodeState } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../agent-kind';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { LeadTreeBrief } from './LeadTreeBrief';
import { LEAD_TREE_UNIT, LeadTreeGuides } from './LeadTreeGuides';
import { LeadTreeSelectedMark } from './LeadTreeSelectedMark';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { leadTreeInkOf } from './leadTreeInkOf';
import { LEAD_TREE_METER } from './leadTreeMeter';
import { LEAD_TREE_MUTED_NODES, LEAD_TREE_QUIET_NODES } from './leadTreeQuietNodes';
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
  readonly depth: number;
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly isCompact: boolean;
  readonly onSelect: (agentId: AgentId) => void;
};

type TitleToneParams = {
  readonly node: WorkNodeState;
  readonly isSettled: boolean;
};

const titleToneOf = ({ node, isSettled }: TitleToneParams): string => {
  if (LEAD_TREE_MUTED_NODES.has(node)) {
    return 'text-faint-foreground';
  }
  return isSettled ? 'text-muted-foreground' : 'text-foreground';
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
    depth,
    isSelected,
    isActive,
    isCompact,
    onSelect,
  }: Props) => {
    const ink = leadTreeInkOf({ node });
    const isMuted = LEAD_TREE_MUTED_NODES.has(node);
    const hasTitle = !isCompact && title !== '';
    return (
      <div
        role="treeitem"
        tabIndex={-1}
        aria-selected={isSelected}
        aria-current={isSelected ? 'true' : undefined}
        aria-label={`${number} ${role}${title === '' ? '' : `, ${title}`}, ${word}`}
        data-selected={isSelected}
        data-lead-tree-id={id}
        data-lead-tree-agent={agentId}
        data-lead-tree-node={node}
        data-active={isActive}
        className={cn(
          LEAD_TREE_ROW,
          'cursor-pointer hover:bg-hover',
          isSelected && 'bg-selected hover:bg-selected',
          isActive && LEAD_TREE_CURSOR,
        )}
        onClick={() => onSelect(agentId)}
      >
        {isSelected ? <LeadTreeSelectedMark /> : null}
        <LeadTreeGuides depth={depth} />
        <span aria-hidden className="shrink-0" style={{ width: depth * LEAD_TREE_UNIT }} />
        <AgentKindChip kind={kind} density="bare" title={role} className={ink.glyph} />
        {hasTitle ? (
          <LeadTreeBrief text={title} className={titleToneOf({ node, isSettled })} />
        ) : (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-ui',
              isMuted ? 'text-faint-foreground' : 'text-foreground',
            )}
          >
            {isCompact ? role : ''}
          </span>
        )}
        {LEAD_TREE_QUIET_NODES.has(node) ? null : (
          <span data-lead-tree-word="" className={cn('shrink-0 text-meta', ink.word)}>
            {word}
          </span>
        )}
        <span
          data-lead-tree-meter=""
          className={cn(
            LEAD_TREE_METER,
            'text-meta tabular-nums',
            isMuted ? 'text-faint-foreground' : 'text-muted-foreground',
          )}
        >
          {isSettled ? formatUsd(spendUsd) : <DelegationClock agentId={agentId} isLive />}
        </span>
      </div>
    );
  },
);

LeadTreeAgentRow.displayName = 'LeadTreeAgentRow';

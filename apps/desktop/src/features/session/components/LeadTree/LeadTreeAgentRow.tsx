import { memo } from 'react';
import type { AgentId } from '@goodboy/types';
import { WorkNode, cn, formatUsd, tintClasses, type WorkNodeState } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../agent-kind';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { LeadTreeBrief } from './LeadTreeBrief';
import { LeadTreeGuide } from './LeadTreeGuide';
import { LeadTreeSelectedMark } from './LeadTreeSelectedMark';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import type { LeadTreeGuide as Guide } from './leadTreeGuidesOf';
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
  readonly guide: Guide;
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
    guide,
    isSelected,
    isActive,
    isCompact,
    onSelect,
  }: Props) => {
    const isWordShown = !LEAD_TREE_QUIET_NODES.has(node);
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
        <LeadTreeGuide
          guide={guide}
          marker={
            <WorkNode look="quiet" state={node} label={word} mark={{ kind: 'dot' }} size="sm" />
          }
        />
        <AgentKindChip
          kind={kind}
          density="glyph"
          title={role}
          className={cn(isMuted && 'text-faint-foreground', isSelected && 'ring-1 ring-primary')}
        />
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
        {isWordShown ? (
          <span
            className={cn(
              'shrink-0 text-meta',
              node === 'failed' ? tintClasses('danger').text : 'text-muted-foreground',
            )}
          >
            {word}
          </span>
        ) : null}
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

import { memo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { ActivityMeta, ActivityRow, WorkNode, cn, type WorkNodeState } from '@goodboy/ui';
import type { AgentKind } from '../../agent-kind';
import { AgentRoleChip } from '../../AgentRoleChip';
import type { RailInk, RailRow } from '../../../workTreeModel/railGeometry';
import { activityStateWordOf } from '../../../workTreeModel/activityStateWordOf';
import { ACTIVITY_TONE_OF_NODE } from '../../../workTreeModel/activityToneOfNode';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { SpawnedRailCell } from '../SessionWorkspace/parts/TimelinePane/SpawnedRailCell';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly sessionId: SessionId;
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
  readonly tail: ReadonlyArray<RailInk>;
  readonly railWidth: number;
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly isCompact: boolean;
  readonly onSelect: (agentId: AgentId) => void;
};

export const LeadTreeAgentRow = memo(
  ({
    id,
    sessionId,
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
    tail,
    railWidth,
    isSelected,
    isActive,
    isCompact,
    onSelect,
  }: Props) => {
    const tone = ACTIVITY_TONE_OF_NODE[node];
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
          tail={tail}
          width={railWidth}
          marker={
            <WorkNode look="quiet" state={node} label={word} mark={{ kind: 'dot' }} size="sm" />
          }
        />
        <ActivityRow
          density="rail"
          tone={tone}
          ordinal={isCompact ? null : <span data-lead-tree-number="">{number}</span>}
          glyph={
            <AgentRoleChip
              sessionId={sessionId}
              agentId={agentId}
              kind={kind}
              position={`Subagent ${number}`}
              costUsd={spendUsd}
            />
          }
          text={<span data-lead-tree-title="">{title === '' ? role : title}</span>}
          meta={
            <ActivityMeta
              density="rail"
              columns={['state', 'time', 'cost']}
              state={activityStateWordOf({ tone, word })}
              time={
                node === 'running' ? (
                  <DelegationClock agentId={agentId} isLive className="text-info" />
                ) : null
              }
              costUsd={isSettled ? spendUsd : null}
            />
          }
        />
      </div>
    );
  },
);

LeadTreeAgentRow.displayName = 'LeadTreeAgentRow';

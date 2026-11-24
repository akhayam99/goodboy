import { memo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { ActivityMeta, ActivityRow, WorkNode, cn } from '@goodboy/ui';
import { AgentRoleChip } from '../../AgentRoleChip';
import type { RailInk, RailRow } from '../../../workTreeModel/railGeometry';
import { activityStateWordOf } from '../../../workTreeModel/activityStateWordOf';
import { ACTIVITY_TONE_OF_NODE } from '../../../workTreeModel/activityToneOfNode';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { SpawnedRailCell } from '../SessionWorkspace/parts/TimelinePane/SpawnedRailCell';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import type { LeadTreeRoot } from './leadTreeRoot';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly root: LeadTreeRoot;
  readonly rail: RailRow;
  readonly tail: ReadonlyArray<RailInk>;
  readonly railWidth: number;
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly onSelect: (agentId: AgentId) => void;
};

const NO_COST = 0;

export const LeadTreeRootRow = memo(
  ({ id, sessionId, root, rail, tail, railWidth, isSelected, isActive, onSelect }: Props) => {
    const tone = ACTIVITY_TONE_OF_NODE[root.node];
    return (
      <div
        role="treeitem"
        tabIndex={-1}
        aria-selected={isSelected}
        aria-label={`Run, ${root.title}, ${root.word}`}
        data-lead-tree-id={id}
        data-lead-tree-root={root.agentId}
        data-lead-tree-node={root.node}
        data-active={isActive}
        className={cn(
          LEAD_TREE_ROW,
          'cursor-pointer hover:bg-hover',
          isSelected && 'bg-selected',
          isActive && LEAD_TREE_CURSOR,
        )}
        onClick={() => onSelect(root.agentId)}
      >
        <SpawnedRailCell
          rail={rail}
          tail={tail}
          width={railWidth}
          marker={
            <WorkNode
              look="quiet"
              state={root.node}
              label={root.word}
              mark={{ kind: 'dot' }}
              size="sm"
            />
          }
        />
        <ActivityRow
          density="rail"
          tone={tone}
          glyph={
            <AgentRoleChip
              sessionId={sessionId}
              agentId={root.agentId}
              kind="auto"
              position="Lead"
              costUsd={NO_COST}
            />
          }
          text={<span data-lead-tree-title="">{root.title}</span>}
          meta={
            <ActivityMeta
              density="rail"
              columns={['state', 'time']}
              state={activityStateWordOf({ tone, word: root.word })}
              time={
                root.node === 'running' ? (
                  <DelegationClock agentId={root.agentId} isLive className="text-info" />
                ) : null
              }
            />
          }
        />
      </div>
    );
  },
);

LeadTreeRootRow.displayName = 'LeadTreeRootRow';

import { memo } from 'react';
import { ChevronDown, ChevronRight } from '@goodboy/ui/icons';
import { ActivityMeta, ActivityRow, ICON_SIZE, WorkNode, cn } from '@goodboy/ui';
import { SpawnedRailCell } from '../SessionWorkspace/parts/TimelinePane/SpawnedRailCell';
import type { RailInk, RailRow } from '../../../workTreeModel/railGeometry';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly isOpen: boolean;
  readonly isActive: boolean;
  readonly rail: RailRow;
  readonly tail: ReadonlyArray<RailInk>;
  readonly railWidth: number;
  readonly onToggle: (id: string) => void;
};

export const LeadTreeFoldRow = memo(
  ({ id, label, isOpen, isActive, rail, tail, railWidth, onToggle }: Props) => {
    const Chevron = isOpen ? ChevronDown : ChevronRight;
    return (
      <div
        role="treeitem"
        tabIndex={-1}
        aria-expanded={isOpen}
        aria-label={`${label}, done, ${isOpen ? 'unfolded' : 'folded'}`}
        data-lead-tree-id={id}
        data-active={isActive}
        className={cn(LEAD_TREE_ROW, 'cursor-pointer hover:bg-hover', isActive && LEAD_TREE_CURSOR)}
        onClick={() => onToggle(id)}
      >
        <SpawnedRailCell
          rail={rail}
          tail={tail}
          width={railWidth}
          marker={
            <WorkNode look="quiet" state="done" label="Done" mark={{ kind: 'dot' }} size="sm" />
          }
        />
        <ActivityRow
          density="rail"
          tone="pending"
          glyph={
            <Chevron size={ICON_SIZE.row} aria-hidden="true" className="text-faint-foreground" />
          }
          text={label}
          meta={
            <ActivityMeta
              density="rail"
              columns={['state']}
              state={
                <span className="text-faint-foreground">{isOpen ? 'done' : 'done · folded'}</span>
              }
            />
          }
        />
      </div>
    );
  },
);

LeadTreeFoldRow.displayName = 'LeadTreeFoldRow';

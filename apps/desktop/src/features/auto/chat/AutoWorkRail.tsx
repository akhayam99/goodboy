import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { AutoBudgetFacts } from '@goodboy/core';
import { IconButton, ScrollFade, WorkNode, Tooltip, cn } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import { AutoRailSpine } from './AutoRailSpine';
import { AutoTreeBudget } from './AutoTreeBudget';
import { AutoWorkRailRow } from './AutoWorkRailRow';
import type { RailRow } from './railRowsOf';
import {
  RAIL_NODE_CENTER_X,
  RAIL_NODE_CENTER_Y,
  RAIL_NODE_SIZE,
  RAIL_ROW_HEIGHT,
} from './railSpec';

type Props = {
  readonly rows: ReadonlyArray<RailRow>;
  readonly budget: AutoBudgetFacts | null;
  readonly selectedAgentId: AgentId | null;
  readonly isCollapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly onOpen: (row: RailRow) => void;
};

const FULL_WIDTH = 240;
const STRIP_WIDTH = 56;

export const AutoWorkRail = ({
  rows,
  budget,
  selectedAgentId,
  isCollapsed,
  onToggleCollapsed,
  onOpen,
}: Props) => (
  <aside
    aria-label="Work"
    data-testid="auto-work-rail"
    data-mode={isCollapsed ? 'strip' : 'full'}
    className={cn(
      'flex shrink-0 flex-col border-r border-border-soft bg-background',
      isCollapsed ? 'w-14' : 'w-60',
    )}
  >
    <header className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
      {isCollapsed ? null : (
        <h2 className="flex items-baseline gap-2 text-eyebrow text-foreground">
          Work
          <span className="tabular-nums text-muted-foreground">{rows.length}</span>
        </h2>
      )}
      <IconButton
        icon={isCollapsed ? PanelLeftOpen : PanelLeftClose}
        label={isCollapsed ? 'Expand the work list' : 'Collapse the work list'}
        variant="ghost"
        size="xs"
        onClick={onToggleCollapsed}
      />
    </header>
    <ScrollFade className="min-h-0 flex-1" fadeSize="h-6">
      <div
        className="relative"
        style={{
          width: isCollapsed ? STRIP_WIDTH : FULL_WIDTH,
          height: rows.length * RAIL_ROW_HEIGHT,
        }}
      >
        <AutoRailSpine rows={rows} width={isCollapsed ? STRIP_WIDTH : FULL_WIDTH} />
        {isCollapsed ? (
          <ol aria-label="Work, as rings" className="list-none">
            {rows.map((row) => (
              <li
                key={row.id}
                className="absolute"
                style={{
                  left: RAIL_NODE_CENTER_X - RAIL_NODE_SIZE / 2,
                  top:
                    rows.indexOf(row) * RAIL_ROW_HEIGHT + RAIL_NODE_CENTER_Y - RAIL_NODE_SIZE / 2,
                }}
              >
                <Tooltip content={`${row.label}, ${row.word}`}>
                  <button
                    type="button"
                    aria-label={`Show ${row.label}`}
                    onClick={() => onOpen(row)}
                  >
                    <WorkNode
                      state={row.node}
                      label={`${row.label}, ${row.word}`}
                      mark={{ kind: 'dot' }}
                    />
                  </button>
                </Tooltip>
              </li>
            ))}
          </ol>
        ) : (
          <ol aria-label="Work" className="list-none">
            {rows.map((row) => (
              <AutoWorkRailRow
                key={row.id}
                row={row}
                isSelected={row.agentId === selectedAgentId}
                onOpen={onOpen}
              />
            ))}
          </ol>
        )}
      </div>
    </ScrollFade>
    {isCollapsed || budget === null ? null : <AutoTreeBudget facts={budget} />}
  </aside>
);

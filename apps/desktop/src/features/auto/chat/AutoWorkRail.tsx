import type { AgentId } from '@goodboy/types';
import { AutoRailSpine } from './AutoRailSpine';
import { AutoWorkRailRow } from './AutoWorkRailRow';
import type { RailRow } from './railRowsOf';
import { RAIL_ROW_HEIGHT } from './railSpec';

type Props = {
  readonly rows: ReadonlyArray<RailRow>;
  readonly selectedAgentId: AgentId | null;
  readonly onOpen: (row: RailRow) => void;
};

const SPINE_WIDTH = 32;

export const AutoWorkRail = ({ rows, selectedAgentId, onOpen }: Props) => (
  <div
    data-testid="auto-work-rail"
    className="relative min-w-0"
    style={{ height: rows.length * RAIL_ROW_HEIGHT }}
  >
    <AutoRailSpine rows={rows} width={SPINE_WIDTH} />
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
  </div>
);

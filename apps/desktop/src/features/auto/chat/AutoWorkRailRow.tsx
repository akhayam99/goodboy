import { WorkNode, cn } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { RoutingLabel } from '../../../shared/components/RoutingLabel';
import { DelegationClock } from './DelegationClock';
import type { RailRow } from './railRowsOf';
import {
  RAIL_NODE_CENTER_X,
  RAIL_NODE_CENTER_Y,
  RAIL_NODE_SIZE,
  RAIL_ROW_HEIGHT,
} from './railSpec';

type Props = {
  readonly row: RailRow;
  readonly isSelected: boolean;
  readonly onOpen: (row: RailRow) => void;
};

const ROOT_INDENT = 36;
const CHILD_INDENT = 48;

const WORD_TONE_CLASS = {
  neutral: 'text-muted-foreground',
  info: 'text-info',
  warning: 'text-warning',
  danger: 'text-danger',
  success: 'text-success',
  primary: 'text-primary',
  merged: 'text-muted-foreground',
  draft: 'text-muted-foreground',
} as const;

export const AutoWorkRailRow = ({ row, isSelected, onOpen }: Props) => (
  <li
    data-rail-row={row.kind}
    className="relative"
    style={{ height: RAIL_ROW_HEIGHT }}
    aria-current={isSelected ? 'true' : undefined}
  >
    <span
      className="absolute"
      style={{
        left: RAIL_NODE_CENTER_X - RAIL_NODE_SIZE / 2,
        top: RAIL_NODE_CENTER_Y - RAIL_NODE_SIZE / 2,
      }}
    >
      <WorkNode state={row.node} label={`${row.label}, ${row.word}`} mark={{ kind: 'dot' }} />
    </span>
    <button
      type="button"
      onClick={() => onOpen(row)}
      aria-label={`Show ${row.label}`}
      className={cn(
        'flex size-full min-w-0 flex-col rounded-md pr-2 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        isSelected ? 'bg-selected' : 'hover:bg-hover',
      )}
      style={{ paddingLeft: row.kind === 'child' ? CHILD_INDENT : ROOT_INDENT }}
    >
      <span className="flex min-w-0 items-center gap-2" style={{ height: RAIL_NODE_CENTER_Y * 2 }}>
        <AgentKindChip kind={row.role} density="glyph" isDecorative />
        <span className="min-w-0 flex-1 truncate text-label text-foreground">{row.label}</span>
        <span className={cn('shrink-0 text-label', WORD_TONE_CLASS[row.tone])}>{row.word}</span>
      </span>
      <span className="flex h-5 min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1">
          <RoutingLabel provider={row.provider} model={row.model} muted />
        </span>
        <DelegationClock
          startedAtMs={row.startedAtMs}
          endedAtMs={row.endedAtMs}
          isLive={row.isLive}
        />
      </span>
    </button>
  </li>
);

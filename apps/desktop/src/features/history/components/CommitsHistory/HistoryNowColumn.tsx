import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { Eyebrow, SegmentedTabs } from '@goodboy/ui';
import type { BranchCommit, HistoryGraph } from '@goodboy/types';
import type { HistoryDropTarget } from '../../useHistoryDrag';
import type { RowPositions } from '../../useRowPositions';
import type { LaneNode } from './HistoryLaneSvg';
import { HistoryNowList } from './HistoryNowList';
import type { HistoryRowView } from './historyRowLine';

type Props = {
  readonly view: HistoryRowView;
  readonly isDone: boolean;
  readonly isNarrow: boolean;
  readonly narrowView: 'now' | 'planned';
  readonly afterCount: number;
  readonly rows: ReadonlyArray<BranchCommit>;
  readonly listRef: RefObject<HTMLDivElement | null>;
  readonly positions: RowPositions;
  readonly nodes: ReadonlyArray<LaneNode>;
  readonly graph: HistoryGraph | null;
  readonly baseSha: string;
  readonly baseBranch: string;
  readonly onto: string | null;
  readonly isInteractive: boolean;
  readonly dropTarget: HistoryDropTarget | null;
  readonly nowMs: number;
  readonly renderRow: (commit: BranchCommit) => ReactNode;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  readonly onNarrowViewChange: (view: 'now' | 'planned') => void;
  readonly onStartFromMain: () => void;
};

const NOW_VIEW_OPTIONS = [
  { value: 'now', label: 'Now' },
  { value: 'planned', label: 'After Apply' },
] as const;

export const HistoryNowColumn = ({
  view,
  isDone,
  isNarrow,
  narrowView,
  afterCount,
  rows,
  listRef,
  positions,
  nodes,
  graph,
  baseSha,
  baseBranch,
  onto,
  isInteractive,
  dropTarget,
  nowMs,
  renderRow,
  onKeyDown,
  onNarrowViewChange,
  onStartFromMain,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-2" onKeyDown={onKeyDown}>
    {isDone ? null : (
      <div className="flex h-6 items-center gap-2 pl-2">
        <Eyebrow label={view === 'planned' ? 'After Apply' : 'Now'} muted />
        <span className="text-label text-faint-foreground">
          {view === 'planned'
            ? `${afterCount} ${afterCount === 1 ? 'commit' : 'commits'}`
            : 'your branch as it is'}
        </span>
        <span className="flex-1" />
        {isNarrow ? (
          <SegmentedTabs
            size="sm"
            ariaLabel="Show"
            options={NOW_VIEW_OPTIONS}
            value={narrowView}
            onChange={onNarrowViewChange}
          />
        ) : null}
      </div>
    )}
    <HistoryNowList
      view={view}
      rows={rows}
      listRef={listRef}
      positions={positions}
      nodes={nodes}
      graph={graph}
      baseSha={baseSha}
      baseBranch={baseBranch}
      onto={onto}
      isInteractive={isInteractive}
      dropTarget={dropTarget}
      nowMs={nowMs}
      renderRow={renderRow}
      onStartFromMain={onStartFromMain}
    />
  </div>
);

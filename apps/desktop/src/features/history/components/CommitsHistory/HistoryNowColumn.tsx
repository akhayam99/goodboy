import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { SegmentedTabs } from '@goodboy/ui';
import type { BranchCommit, HistoryGraph, SessionId } from '@goodboy/types';
import type { HistoryDropTarget } from '../../useHistoryDrag';
import type { RowPositions } from '../../useRowPositions';
import type { LaneNode } from './HistoryLaneSvg';
import type { RebaseRequest } from './HistoryBaseRow';
import { HistoryNowList } from './HistoryNowList';
import type { HistoryRowView } from './historyRowLine';

type Props = {
  readonly sessionId: SessionId;
  readonly repoPath: string;
  readonly ownBranch: string;
  readonly view: HistoryRowView;
  readonly isDone: boolean;
  readonly isNarrow: boolean;
  readonly hasPlan: boolean;
  readonly narrowView: 'now' | 'planned';
  readonly rows: ReadonlyArray<BranchCommit>;
  readonly listRef: RefObject<HTMLDivElement | null>;
  readonly positions: RowPositions;
  readonly nodes: ReadonlyArray<LaneNode>;
  readonly graph: HistoryGraph | null;
  readonly baseSha: string;
  readonly baseBranch: string;
  readonly isInteractive: boolean;
  readonly dropTarget: HistoryDropTarget | null;
  readonly nowMs: number;
  readonly renderRow: (commit: BranchCommit) => ReactNode;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  readonly onNarrowViewChange: (view: 'now' | 'planned') => void;
  readonly onRebase: (params: RebaseRequest) => void;
};

const NOW_VIEW_OPTIONS = [
  { value: 'now', label: 'Now' },
  { value: 'planned', label: 'After Apply' },
] as const;

export const HistoryNowColumn = ({
  sessionId,
  repoPath,
  ownBranch,
  view,
  isDone,
  isNarrow,
  hasPlan,
  narrowView,
  rows,
  listRef,
  positions,
  nodes,
  graph,
  baseSha,
  baseBranch,
  isInteractive,
  dropTarget,
  nowMs,
  renderRow,
  onKeyDown,
  onNarrowViewChange,
  onRebase,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-2" onKeyDown={onKeyDown}>
    {hasPlan && !isDone ? (
      <div className="flex h-6 items-center justify-between gap-2 pl-2">
        {isNarrow ? (
          <SegmentedTabs
            size="sm"
            ariaLabel="Show"
            options={NOW_VIEW_OPTIONS}
            value={narrowView}
            onChange={onNarrowViewChange}
          />
        ) : (
          <span className="text-label text-foreground">Now</span>
        )}
      </div>
    ) : null}
    <HistoryNowList
      sessionId={sessionId}
      repoPath={repoPath}
      ownBranch={ownBranch}
      view={view}
      rows={rows}
      listRef={listRef}
      positions={positions}
      nodes={nodes}
      graph={graph}
      baseSha={baseSha}
      baseBranch={baseBranch}
      isInteractive={isInteractive}
      dropTarget={dropTarget}
      nowMs={nowMs}
      renderRow={renderRow}
      onRebase={onRebase}
    />
  </div>
);

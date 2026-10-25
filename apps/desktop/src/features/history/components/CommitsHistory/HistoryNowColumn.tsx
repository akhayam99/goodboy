import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import type { BranchCommit, HistoryGraph, SessionId } from '@goodboy/types';
import type { HistoryDropTarget } from '../../hooks/useHistoryDrag';
import type { RowPositions } from '../../hooks/useRowPositions';
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
  readonly onRebase: (params: RebaseRequest) => void;
};

export const HistoryNowColumn = ({
  sessionId,
  repoPath,
  ownBranch,
  view,
  isDone,
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
  onRebase,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-2" onKeyDown={onKeyDown}>
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

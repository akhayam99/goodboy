import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import type { BranchCommit, HistoryGraph, SessionId } from '@goodboy/types';
import { countNoun } from '../../../../shared/utils/countNoun';
import type { HistoryDropTarget } from '../../hooks/useHistoryDrag';
import type { RowPositions } from '../../hooks/useRowPositions';
import type { LaneNode } from './HistoryLaneSvg';
import { HistoryNowList } from './HistoryNowList';
import type { HistoryRowView } from './historyRowLine';

type Props = {
  readonly sessionId: SessionId;
  readonly view: HistoryRowView;
  readonly isDone: boolean;
  readonly rows: ReadonlyArray<BranchCommit>;
  readonly listRef: RefObject<HTMLDivElement | null>;
  readonly positions: RowPositions;
  readonly nodes: ReadonlyArray<LaneNode>;
  readonly graph: HistoryGraph | null;
  readonly baseSha: string;
  readonly baseBranch: string;
  readonly dropTarget: HistoryDropTarget | null;
  readonly nowMs: number;
  readonly renderRow: (commit: BranchCommit) => ReactNode;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

export const HistoryNowColumn = ({
  sessionId,
  view,
  isDone,
  rows,
  listRef,
  positions,
  nodes,
  graph,
  baseSha,
  baseBranch,
  dropTarget,
  nowMs,
  renderRow,
  onKeyDown,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-2" onKeyDown={onKeyDown}>
    <p data-history-count="" className="px-2 text-meta text-muted-foreground">
      {countNoun({ count: rows.length, one: 'commit' })}
    </p>
    <HistoryNowList
      sessionId={sessionId}
      view={view}
      rows={rows}
      listRef={listRef}
      positions={positions}
      nodes={nodes}
      graph={graph}
      baseSha={baseSha}
      baseBranch={baseBranch}
      dropTarget={dropTarget}
      nowMs={nowMs}
      renderRow={renderRow}
    />
  </div>
);

import type { BranchCommit } from '@goodboy/types';
import type { HistoryRowMark } from '../../historyRowMarks';
import type { RowPositions } from '../../useRowPositions';
import type { HistoryApplied } from '../../../../store/slices/history/types';
import type { LaneNode } from './HistoryLaneSvg';

type Params = {
  readonly rows: ReadonlyArray<BranchCommit>;
  readonly marks: ReadonlyMap<string, HistoryRowMark>;
  readonly applied: HistoryApplied | null;
  readonly positions: RowPositions;
  readonly highlightedRows: ReadonlySet<string>;
  readonly workingSha: string | null;
  readonly isDone: boolean;
};

export const historyLaneNodes = ({
  rows,
  marks,
  applied,
  positions,
  highlightedRows,
  workingSha,
  isDone,
}: Params): ReadonlyArray<LaneNode> =>
  rows.map((commit) => {
    const mark = marks.get(commit.sha);
    const includes = applied?.includes[commit.sha] ?? [];
    return {
      key: commit.sha,
      y: positions.y.get(commit.sha) ?? 0,
      color: isDone ? 'lane' : (mark?.action ?? 'pick'),
      ring: isDone
        ? includes.length > 0
          ? 'lane'
          : null
        : mark !== undefined && mark.into === null && mark.takesIn.length > 0
          ? mark.takesInMode
          : null,
      isHighlighted: highlightedRows.has(commit.sha),
      isWorking: workingSha === commit.sha,
    };
  });

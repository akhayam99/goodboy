import { Fragment, type ReactNode, type RefObject } from 'react';
import { cn } from '@goodboy/ui';
import type { BranchCommit, HistoryGraph, SessionId } from '@goodboy/types';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { historyDaysOf } from '../../historyDaysOf';
import { HISTORY_GRAPH } from '../../historyGraphGeometry';
import type { HistoryDropTarget } from '../../hooks/useHistoryDrag';
import type { RowPositions } from '../../hooks/useRowPositions';
import { HistoryBaseRow, type RebaseRequest } from './HistoryBaseRow';
import { HistoryLaneSvg, type LaneNode } from './HistoryLaneSvg';
import type { HistoryRowView } from './historyRowLine';

type Props = {
  readonly sessionId: SessionId;
  readonly repoPath: string;
  readonly ownBranch: string;
  readonly view: HistoryRowView;
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
  readonly onRebase: (params: RebaseRequest) => void;
};

export const HistoryNowList = ({
  sessionId,
  repoPath,
  ownBranch,
  view,
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
  onRebase,
}: Props) => {
  const forkAge =
    graph === null
      ? ''
      : formatAge({
          from: new Date(graph.mergeBase.timestamp * 1000).toISOString(),
          now: nowMs,
        });
  return (
    <div ref={listRef} className="relative flex flex-col">
      <div role="list" aria-label="Commits" className="flex flex-col">
        {historyDaysOf({ commits: rows, nowMs }).map((day) => (
          <Fragment key={day.commits[0]?.sha}>
            <div
              role="presentation"
              className="grid min-h-7 grid-cols-[36px_minmax(0,1fr)] items-center"
            >
              <span aria-hidden />
              <span className="px-2 text-row text-faint-foreground">{day.label}</span>
            </div>
            {day.commits.map(renderRow)}
          </Fragment>
        ))}
      </div>
      <div
        data-graph-key="fork"
        className="grid min-h-7 grid-cols-[36px_minmax(0,1fr)] items-center"
      >
        <span aria-hidden />
        <span className="flex min-w-0 items-center gap-3 px-2 text-meta text-muted-foreground">
          <HistoryBaseRow
            sessionId={sessionId}
            graph={graph}
            baseBranch={baseBranch}
            baseSha={baseSha}
            forkAge={forkAge}
            repoPath={repoPath}
            ownBranch={ownBranch}
            isInteractive={isInteractive && view === 'now'}
            isDone={view === 'done'}
            onRebase={onRebase}
          />
        </span>
      </div>
      <HistoryLaneSvg
        width={HISTORY_GRAPH.gutter}
        height={positions.height}
        trunkX={HISTORY_GRAPH.trunkX}
        laneX={HISTORY_GRAPH.laneX}
        mainY={null}
        forkY={positions.y.get('fork') ?? null}
        nodes={nodes}
        isDashed={view === 'planned'}
        isForkOnMain={false}
      />
      {dropTarget !== null && dropTarget.mode === 'slot' ? (
        <div
          aria-hidden
          data-history-slot
          style={{ top: dropTarget.y }}
          className="pointer-events-none absolute left-9 right-1.5 h-0"
        >
          <span className="absolute -top-1.5 left-0 size-2 rounded-full border-2 border-history-move bg-background" />
          <span
            className={cn('absolute -top-px left-3.5 right-0 h-0.5 rounded-full bg-history-move')}
          />
        </div>
      ) : null}
    </div>
  );
};

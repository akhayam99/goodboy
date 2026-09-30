import type { ReactNode, RefObject } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import type { BranchCommit, HistoryGraph } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { HISTORY_GRAPH } from '../../historyGraphGeometry';
import type { HistoryDropTarget } from '../../useHistoryDrag';
import type { RowPositions } from '../../useRowPositions';
import { HistoryChangeMark } from './HistoryChangeMark';
import { HistoryLaneSvg, type LaneNode } from './HistoryLaneSvg';
import type { HistoryRowView } from './historyRowLine';

type Props = {
  readonly view: HistoryRowView;
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
  readonly onStartFromMain: () => void;
};

const MAIN_DOT_LIMIT = 8;
const MAIN_ROW_LIMIT = 5;

const plural = ({ count, word }: { readonly count: number; readonly word: string }) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

export const HistoryNowList = ({
  view,
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
  onStartFromMain,
}: Props) => {
  const behind = graph?.behind ?? 0;
  const isPlannedOnMain = view === 'planned' && onto !== null;
  const hasMainRow = behind > 0 && !isPlannedOnMain;
  const mainHead = graph?.mainCommits[0] ?? null;
  const mainShort = (graph?.mainHead ?? '').slice(0, 7);
  const forkAge =
    graph === null
      ? ''
      : formatAge({
          from: new Date(graph.mergeBase.timestamp * 1000).toISOString(),
          now: nowMs,
        });
  const mainDots = (graph?.mainCommits ?? [])
    .slice(1, MAIN_DOT_LIMIT + 1)
    .map((commit) => commit.subject);
  return (
    <div ref={listRef} className="relative flex flex-col">
      {hasMainRow ? (
        <div
          data-graph-key="main"
          className="grid min-h-12 grid-cols-[100px_48px_minmax(0,1fr)] items-center"
        >
          <span aria-hidden />
          <span className="flex justify-end pr-2.5">
            {view === 'now' && onto !== null ? (
              <HistoryChangeMark
                action="rebase"
                label="Your branch will start here on Apply (rebase)"
              >
                <ArrowUp size={ICON_SIZE.row} aria-hidden />
                {behind}
              </HistoryChangeMark>
            ) : null}
          </span>
          <span className="flex min-w-0 items-center gap-2.5 px-2.5 text-label text-muted-foreground">
            <span className="shrink-0">
              <span className="text-foreground">main</span> is here now
            </span>
            <span className="shrink-0 font-mono tabular-nums">{mainShort}</span>
            <span className="min-w-0 truncate">
              {onto !== null && view === 'now'
                ? 'your branch will start here on Apply'
                : `${plural({ count: behind, word: 'commit' })} newer than where your branch started`}
            </span>
            {isInteractive && onto === null && view !== 'done' ? (
              <Button size="sm" variant="secondary" className="shrink-0" onClick={onStartFromMain}>
                <ArrowUp size={ICON_SIZE.row} aria-hidden />
                Start from today&apos;s main
              </Button>
            ) : null}
          </span>
        </div>
      ) : null}
      <div role="list" aria-label="Commits" className="flex flex-col">
        {rows.map(renderRow)}
      </div>
      <div
        data-graph-key="fork"
        className="grid min-h-12 grid-cols-[100px_48px_minmax(0,1fr)] items-center"
      >
        <span aria-hidden />
        <span aria-hidden />
        <span className="flex min-w-0 items-center gap-2.5 px-2.5 text-label text-muted-foreground">
          {isPlannedOnMain ? (
            <>
              <span className="shrink-0 text-foreground">Starts from today&apos;s main</span>
              <span className="shrink-0 font-mono tabular-nums">{mainShort}</span>
              <span className="min-w-0 truncate">{mainHead?.subject ?? ''}</span>
            </>
          ) : (
            <>
              <span className="shrink-0 text-foreground">
                {behind === 0 && view !== 'done'
                  ? "Your branch starts on today's main"
                  : 'Your branch starts here'}
              </span>
              <span className="shrink-0 font-mono tabular-nums">{baseSha.slice(0, 7)}</span>
              <span className="min-w-0 truncate">
                {graph === null
                  ? `${baseBranch} · merge base`
                  : `${baseBranch} at ${graph.mergeBase.subject}, ${forkAge}`}
              </span>
            </>
          )}
        </span>
      </div>
      {isPlannedOnMain
        ? (graph?.mainCommits ?? []).slice(1, MAIN_ROW_LIMIT + 1).map((commit) => (
            <div
              key={commit.sha}
              className="grid min-h-7 grid-cols-[100px_48px_minmax(0,1fr)] items-center"
            >
              <span aria-hidden />
              <span aria-hidden />
              <span className="flex min-w-0 items-center gap-2.5 px-2.5 text-label text-faint-foreground">
                <span className="shrink-0 font-mono tabular-nums">{commit.sha.slice(0, 7)}</span>
                <span className="min-w-0 truncate">{commit.subject}</span>
              </span>
            </div>
          ))
        : null}
      <HistoryLaneSvg
        width={HISTORY_GRAPH.gutter}
        height={positions.height}
        trunkX={HISTORY_GRAPH.trunkX}
        laneX={HISTORY_GRAPH.laneX}
        mainY={positions.y.get('main') ?? null}
        forkY={positions.y.get('fork') ?? null}
        mainDots={hasMainRow ? mainDots : []}
        nodes={nodes}
        isDashed={view === 'planned'}
        isForkOnMain={isPlannedOnMain}
      />
      {dropTarget !== null && dropTarget.mode === 'slot' ? (
        <div
          aria-hidden
          data-history-slot
          style={{ top: dropTarget.y }}
          className="pointer-events-none absolute left-17 right-1.5 h-0"
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

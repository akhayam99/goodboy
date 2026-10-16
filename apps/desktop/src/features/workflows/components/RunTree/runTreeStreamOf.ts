import type { WorkflowRun } from '@goodboy/types';
import type {
  TimelineStream,
  TimelineStreamItem,
} from '../../../session/timeline/buildTimelineStream';
import type { RowPhase, RowState } from '../../../workTreeModel/rowState';

type Params = {
  readonly stream: TimelineStream;
  readonly run: Pick<WorkflowRun, 'discardedAt' | 'orchestrationStop'>;
  readonly rowHeight: number | null;
};

const UNFINISHED: ReadonlySet<RowPhase> = new Set<RowPhase>(['queued', 'running', 'waiting']);

const STOPPED_ROW: RowState = { phase: 'closed', reason: { kind: 'stopped' }, ask: null };

type StateParams = {
  readonly state: RowState;
  readonly run: Params['run'];
};

const rowStateOf = ({ state, run }: StateParams): RowState => {
  if (run.discardedAt != null && UNFINISHED.has(state.phase)) {
    return STOPPED_ROW;
  }
  const isCapped = run.orchestrationStop?.kind === 'budget';
  if (isCapped && state.phase === 'waiting' && state.reason?.kind === 'ready') {
    return { phase: 'waiting', reason: { kind: 'budget', limitUsd: null }, ask: null };
  }
  return state;
};

type ItemParams = {
  readonly item: TimelineStreamItem;
  readonly run: Params['run'];
  readonly rowHeight: number | null;
};

const itemOf = ({ item, run, rowHeight }: ItemParams): TimelineStreamItem => {
  const sized =
    rowHeight === null
      ? item
      : { ...item, height: rowHeight, topY: 0, markerY: rowHeight / 2, gap: 'none' as const };
  if (sized.kind !== 'row') {
    return sized;
  }
  return { ...sized, rowState: rowStateOf({ state: sized.rowState, run }) };
};

export const runTreeStreamOf = ({ stream, run, rowHeight }: Params): TimelineStream => ({
  ...stream,
  items: stream.items.map((item) => itemOf({ item, run, rowHeight })),
});

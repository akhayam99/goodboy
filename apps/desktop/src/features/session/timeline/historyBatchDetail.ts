import type { SessionEvent } from '@goodboy/types';
import type { TimelineHistoryBatch } from './buildTimelineGroups';

const LINE_HEIGHT = 20;

const LINE_GAP = 4;

const DETAIL_PADDING = 8;

export type HistoryBatchDetail = {
  readonly events: ReadonlyArray<SessionEvent>;
  readonly height: number;
};

type Params = {
  readonly batch: TimelineHistoryBatch;
};

export const historyBatchDetailOf = ({ batch }: Params): HistoryBatchDetail => {
  const count = batch.events.length;
  return {
    events: batch.events,
    height: DETAIL_PADDING + count * LINE_HEIGHT + Math.max(0, count - 1) * LINE_GAP,
  };
};

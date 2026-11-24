import type { CSSProperties } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
import type { BoardLanes } from './boardLanesOf';

type Params = {
  readonly layout: BoardLanes;
  readonly laneRem: number;
};

type LaneColumns = Readonly<{
  className: string;
  style: CSSProperties | undefined;
}>;

export const laneColumnsOf = ({ layout, laneRem }: Params): LaneColumns => {
  if (layout.scrolls) {
    return {
      className: PANE_RHYTHM.board.lanesScroll,
      style: { gridTemplateColumns: `repeat(${layout.lanes},${laneRem}rem)` },
    };
  }
  return {
    className: layout.stacked ? PANE_RHYTHM.board.lanesFour : PANE_RHYTHM.board.lanesFive,
    style: undefined,
  };
};

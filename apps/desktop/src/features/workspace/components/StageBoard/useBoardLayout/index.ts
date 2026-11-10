import { useMemo } from 'react';
import { useElementWidth } from '../../../../../shared/hooks/useElementWidth';
import { boardLanesOf, rootRemPx, type BoardLanes } from '../boardLanesOf';
import { scrollLaneRemOf } from '../scrollLaneRemOf';

const WIDTH_BEFORE_MEASURE = Number.POSITIVE_INFINITY;

type BoardLayout = {
  readonly ref: (node: HTMLElement | null) => void;
  readonly layout: BoardLanes;
  readonly scrollLaneRem: number;
};

export const useBoardLayout = (): BoardLayout => {
  const frame = useElementWidth();
  const remPx = useMemo(() => rootRemPx(), []);
  const width = frame.width ?? WIDTH_BEFORE_MEASURE;
  return {
    ref: frame.ref,
    layout: boardLanesOf({ width, remPx }),
    scrollLaneRem: scrollLaneRemOf({ width, remPx }),
  };
};

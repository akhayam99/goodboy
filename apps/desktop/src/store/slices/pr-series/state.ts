import type { PrSeriesView } from '@goodboy/types';
import type { MergeTrain } from './mergeTrain';

export type PrSeriesState = {
  readonly prSeries: Readonly<Record<string, ReadonlyArray<PrSeriesView>>>;
  readonly mergeTrain: MergeTrain | null;
};

export const prSeriesInitialState: PrSeriesState = {
  prSeries: {},
  mergeTrain: null,
};

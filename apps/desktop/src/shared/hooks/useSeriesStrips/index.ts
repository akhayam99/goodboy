import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { seriesStripsOf, type SeriesStrip } from '../../../store/slices/pr-series/seriesStripsOf';

type Params = {
  readonly sessionId: SessionId;
};

export const useSeriesStrips = ({ sessionId }: Params): ReadonlyArray<SeriesStrip> => {
  const json = useAppStore((state) => JSON.stringify(seriesStripsOf({ state, sessionId })));
  return useMemo((): ReadonlyArray<SeriesStrip> => JSON.parse(json), [json]);
};

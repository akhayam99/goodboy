import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import type { SeriesStrip } from '../../store/slices/pr-series/seriesStripsOf';
import type { SessionSuggestion } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly strip: SeriesStrip;
};

export const seriesMergeSuggestionOf = ({ sessionId, strip }: Params): SessionSuggestion | null => {
  const open = strip.parts.filter((part) => part.state === 'open' && part.number !== null);
  const [first] = open;
  if (first === undefined || open.length < 2) {
    return null;
  }
  const isEveryHostAble = open.every(
    (part) =>
      part.provider !== null && REVIEW_SOURCE_CAPABILITIES[part.provider].canChooseMergeMethod,
  );
  if (!isEveryHostAble) {
    return null;
  }
  return {
    id: `merge-series:${strip.id}`,
    kind: 'merge-series',
    priority: 43,
    band: 2,
    title: `Merge ${strip.name} in order`,
    detail: `${open.length} parts, part ${first.label} first`,
    sessionId,
    targetKey: `series:${strip.id}`,
    fingerprint: `merge-series:${strip.id}:${open.map((part) => part.label).join(',')}`,
    payload: { seriesId: strip.id, name: strip.name, labels: open.map((part) => part.label) },
  };
};

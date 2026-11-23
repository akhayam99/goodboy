import type { PrSeriesId, SessionId } from '@goodboy/types';
import { seriesStripsOf } from './seriesStripsOf';
import type { SliceDeps } from '../../slice-types';
import { pullRequestPortFor } from '../review-source/pullRequestPortFor';
import { mergeInOrder, type MergeEntry } from './mergeInOrder';

export type MergeSeriesParams = Readonly<{
  sessionId: SessionId;
  seriesId: PrSeriesId;
}>;

export type MergeSeriesResult =
  | Readonly<{ kind: 'gone' }>
  | Readonly<{ kind: 'done'; merged: number }>
  | Readonly<{
      kind: 'stopped';
      merged: number;
      partLabel: string;
      reason: string;
    }>;

type Deps = Pick<SliceDeps, 'get'> & {
  readonly portFor?: typeof pullRequestPortFor;
};

export const mergeSeriesInOrder =
  ({ get, portFor = pullRequestPortFor }: Deps) =>
  async ({ sessionId, seriesId }: MergeSeriesParams): Promise<MergeSeriesResult> => {
    const strip = seriesStripsOf({ state: get(), sessionId }).find(
      (candidate) => candidate.id === seriesId,
    );
    if (strip === undefined) {
      return { kind: 'gone' };
    }
    const parts = strip.parts.flatMap((part) =>
      part.state === 'open' && part.mountId !== null && part.number !== null
        ? [{ part, mountId: part.mountId, prNumber: part.number }]
        : [],
    );
    const entries = parts.map(({ part, mountId, prNumber }): MergeEntry => ({
      sessionId,
      mountId,
      prNumber,
      label: `part ${part.label}`,
    }));
    const result = await mergeInOrder({ get, portFor })({
      entries,
      method: null,
      shouldUpdate: false,
      shouldWait: false,
      shouldHandConflicts: false,
    });
    if (result.kind !== 'stopped') {
      return { kind: 'done', merged: result.merged };
    }
    return {
      kind: 'stopped',
      merged: result.merged,
      partLabel: parts[result.index]?.part.label ?? '',
      reason: result.reason,
    };
  };

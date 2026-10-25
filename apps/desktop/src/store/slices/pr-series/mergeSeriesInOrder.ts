import { formatError } from '@goodboy/ui';
import type { PrSeriesId, SessionId } from '@goodboy/types';
import { seriesStripsOf, type SeriesPart } from './seriesStripsOf';
import type { SliceDeps } from '../../slice-types';
import { pullRequestPortFor } from '../review-source/pullRequestPortFor';
import { mergeBlockerOf } from './mergeBlockerOf';

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

type StopParams = {
  readonly merged: number;
  readonly part: SeriesPart;
  readonly reason: string;
};

const stopped = ({ merged, part, reason }: StopParams): MergeSeriesResult => ({
  kind: 'stopped',
  merged,
  partLabel: part.label,
  reason,
});

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
    const queue = strip.parts.filter(
      (part) => part.state === 'open' && part.mountId !== null && part.number !== null,
    );
    let merged = 0;
    for (const part of queue) {
      const { mountId, number } = part;
      if (mountId === null || number === null) {
        continue;
      }
      const port = portFor({ get, sessionId, mountId, prNumber: number });
      if (port === null) {
        return stopped({ merged, part, reason: 'Goodboy cannot reach its host from here' });
      }
      try {
        const view = await port.read();
        const blocker = mergeBlockerOf({ view });
        if (blocker !== null) {
          return stopped({ merged, part, reason: `part ${part.label} ${blocker}` });
        }
        await get().mergePr(sessionId, view.number, view.mergeMethods[0] ?? 'squash', {
          mountId,
          expectedHeadSha: view.headSha,
        });
      } catch (error) {
        return stopped({ merged, part, reason: formatError(error) });
      }
      merged += 1;
    }
    return { kind: 'done', merged };
  };

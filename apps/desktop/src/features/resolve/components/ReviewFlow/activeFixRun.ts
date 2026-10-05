import type { ResolveAttempt } from '@goodboy/types';
import { launchKeyOf } from '../../../../store/slices/resolve/resolveLaunch';
import type { ReviewEntry } from './useReviewEntries';

export type FixRun = {
  readonly launchId: string;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

const isCouldntFix = ({ entry }: { readonly entry: ReviewEntry }): boolean =>
  entry.resolveWord === 'couldnt_fix' && entry.isFixable;

const isLiveEntry = ({ entry }: { readonly entry: ReviewEntry }): boolean =>
  entry.resolveWord === 'working' ||
  entry.resolveWord === 'needs_you' ||
  entry.resolveWord === 'ready' ||
  isCouldntFix({ entry });

const latestOf = ({
  attempts,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
}): ResolveAttempt | null =>
  attempts.reduce<ResolveAttempt | null>(
    (latest, attempt) =>
      latest === null || attempt.createdAt > latest.createdAt ? attempt : latest,
    null,
  );

export const activeFixRunOf = ({
  entries,
}: {
  readonly entries: ReadonlyArray<ReviewEntry>;
}): FixRun | null => {
  const attempted = entries.flatMap((entry) =>
    entry.row.attempt === null ? [] : [{ entry, attempt: entry.row.attempt }],
  );
  const latest = latestOf({ attempts: attempted.map(({ attempt }) => attempt) });
  if (latest === null) {
    return null;
  }
  const launchId = launchKeyOf({ attempt: latest });
  const runEntries = attempted
    .filter(({ attempt }) => launchKeyOf({ attempt }) === launchId)
    .map(({ entry }) => entry);
  if (!runEntries.some((entry) => isLiveEntry({ entry }))) {
    return null;
  }
  return { launchId, entries: runEntries };
};

export const retryableOf = ({ run }: { readonly run: FixRun }): ReadonlyArray<ReviewEntry> =>
  run.entries.filter((entry) => isCouldntFix({ entry }));

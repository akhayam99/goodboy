import type { PrCheckConclusion, PrCheckRun } from '@goodboy/types';

type Bucket = 'failed' | 'in progress' | 'passed' | 'cancelled' | 'skipped' | 'needs attention';

const BUCKET_ORDER: ReadonlyArray<Bucket> = [
  'failed',
  'in progress',
  'needs attention',
  'passed',
  'cancelled',
  'skipped',
];

type BucketParams = {
  readonly conclusion: PrCheckConclusion;
};

const bucketOf = ({ conclusion }: BucketParams): Bucket => {
  switch (conclusion) {
    case 'failure':
    case 'timed_out':
      return 'failed';
    case 'pending':
      return 'in progress';
    case 'success':
      return 'passed';
    case 'cancelled':
      return 'cancelled';
    case 'skipped':
    case 'neutral':
    case 'stale':
      return 'skipped';
    case 'action_required':
    case 'unknown':
      return 'needs attention';
    default: {
      const unexpectedConclusion: never = conclusion;
      return unexpectedConclusion;
    }
  }
};

type Params = {
  readonly checks: ReadonlyArray<PrCheckRun>;
};

export const checksRollup = ({ checks }: Params): string => {
  if (checks.length === 0) {
    return '';
  }
  const counts = new Map<Bucket, number>();
  for (const check of checks) {
    const bucket = bucketOf({ conclusion: check.conclusion });
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return BUCKET_ORDER.filter((bucket) => (counts.get(bucket) ?? 0) > 0)
    .map((bucket) => `${counts.get(bucket) ?? 0} ${bucket}`)
    .join(', ');
};

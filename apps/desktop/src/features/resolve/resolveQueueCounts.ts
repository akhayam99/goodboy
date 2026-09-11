import type { ResolveQueueStatus } from '../../store/slices/resolve/deriveResolveQueueStatus';
import type { ResolveQueueRow } from './buildResolveQueueRows';

export type ResolveQueueCountKey = 'queued' | 'working' | 'question' | 'failed' | 'published';

export type ResolveQueueCounts = Readonly<Record<ResolveQueueCountKey, number>>;

const BUCKET_BY_STATUS: Record<ResolveQueueStatus, ResolveQueueCountKey | null> = {
  fix_ready: 'queued',
  reply_ready: 'queued',
  no_change: 'queued',
  changed_since_accepted: 'queued',
  ready_to_push: 'queued',
  wont_fix: 'queued',
  working: 'working',
  agent_asked: 'question',
  run_failed: 'failed',
  run_stopped: 'failed',
  delivery_failed: 'failed',
  confirm_delivery: 'failed',
  pushed: 'published',
  wont_fix_sent: 'published',
  later: null,
};

const EMPTY_COUNTS: ResolveQueueCounts = {
  queued: 0,
  working: 0,
  question: 0,
  failed: 0,
  published: 0,
};

export const resolveQueueCounts = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
}): ResolveQueueCounts =>
  rows.reduce<ResolveQueueCounts>((counts, row) => {
    const bucket = BUCKET_BY_STATUS[row.status];
    return bucket === null ? counts : { ...counts, [bucket]: counts[bucket] + 1 };
  }, EMPTY_COUNTS);

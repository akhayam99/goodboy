import { RESOLVE_QUEUE_COUNTS_LABEL, RESOLVE_QUEUE_COUNT_LABEL } from '../../resolveQueueCopy';
import type { ResolveQueueCountKey, ResolveQueueCounts } from '../../resolveQueueCounts';

type Props = {
  readonly counts: ResolveQueueCounts;
};

const ORDER: ReadonlyArray<ResolveQueueCountKey> = [
  'queued',
  'working',
  'question',
  'failed',
  'published',
];

export const QueueCountsLine = ({ counts }: Props) => {
  const shown = ORDER.filter((key) => counts[key] > 0);
  if (shown.length === 0) {
    return null;
  }
  return (
    <ul
      aria-label={RESOLVE_QUEUE_COUNTS_LABEL}
      className="flex min-w-0 flex-wrap items-center gap-3 text-2xs text-muted-foreground"
    >
      {shown.map((key) => (
        <li key={key} className="flex items-center gap-1">
          <span className="tabular-nums text-foreground">{counts[key]}</span>
          <span>{RESOLVE_QUEUE_COUNT_LABEL[key]}</span>
        </li>
      ))}
    </ul>
  );
};

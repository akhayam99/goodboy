import type { TurnBucket } from '@goodboy/db';
import { cn, tintClasses, Tooltip } from '@goodboy/ui';

type Props = {
  readonly buckets: ReadonlyArray<TurnBucket>;
  readonly median: number;
  readonly maxAgents: number;
};

export const TurnHistogram = ({ buckets, median, maxAgents }: Props) => (
  <div className="flex h-12 items-end gap-px">
    {buckets.map((bucket) => (
      <Tooltip
        key={bucket.turnCount}
        content={`${bucket.agentCount} agents ran ${bucket.turnCount} turns`}
      >
        <div
          style={{ height: `${Math.max((bucket.agentCount / maxAgents) * 100, 6)}%` }}
          className={cn(
            'min-h-0.5 flex-1 rounded-lg',
            bucket.turnCount === median ? tintClasses('primary').dot : 'bg-idle',
          )}
        />
      </Tooltip>
    ))}
  </div>
);

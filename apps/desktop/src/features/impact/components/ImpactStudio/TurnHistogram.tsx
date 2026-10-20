import type { TurnBucket } from '@goodboy/db';
import { FactCard, cn, tintClasses } from '@goodboy/ui';

type Props = {
  readonly buckets: ReadonlyArray<TurnBucket>;
  readonly median: number;
  readonly maxAgents: number;
};

export const TurnHistogram = ({ buckets, median, maxAgents }: Props) => {
  const totalAgents = buckets.reduce((sum, bucket) => sum + bucket.agentCount, 0);
  return (
    <div className="flex h-12 items-end gap-px">
      {buckets.map((bucket) => (
        <FactCard
          key={bucket.turnCount}
          card={{
            title: bucket.turnCount === 1 ? '1 turn' : `${bucket.turnCount} turns`,
            facts: [
              { label: 'Agents', value: String(bucket.agentCount) },
              {
                label: 'Share',
                value: `${totalAgents === 0 ? 0 : Math.round((bucket.agentCount / totalAgents) * 100)}%`,
              },
            ],
            ...(bucket.turnCount === median ? { footnote: 'Median turn count' } : {}),
          }}
        >
          <div
            style={{ height: `${Math.max((bucket.agentCount / maxAgents) * 100, 6)}%` }}
            className={cn(
              'min-h-0.5 flex-1 rounded-lg',
              bucket.turnCount === median ? tintClasses('primary').dot : 'bg-idle',
            )}
          />
        </FactCard>
      ))}
    </div>
  );
};

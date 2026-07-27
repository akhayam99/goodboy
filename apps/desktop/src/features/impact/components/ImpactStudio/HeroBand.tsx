import type { OrchestrationOverview } from '@goodboy/db';
import { Chip, Eyebrow, Skeleton, SkeletonText } from '@goodboy/ui';
import { formatShare } from '../../utils/formatShare';
import { rankContributors } from '../../utils/rankContributors';

type Props = {
  readonly overview: OrchestrationOverview | null;
  readonly allTimeOverview: OrchestrationOverview | null;
};

export const HeroBand = ({ overview, allTimeOverview }: Props) => {
  if (overview === null || allTimeOverview === null) {
    return (
      <div className="flex flex-col gap-3">
        <Eyebrow label="orchestrated share" />
        <Skeleton className="h-12 w-40" />
        <SkeletonText lines={1} className="max-w-md" />
      </div>
    );
  }

  const isFallback = overview.sessionCount === 0 && allTimeOverview.sessionCount > 0;
  const source = isFallback ? allTimeOverview : overview;
  const ranked = rankContributors({ overview: source });
  const strongest = ranked[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Eyebrow label="orchestrated share" tone="primary" />
        {isFallback ? <Chip tone="neutral" label="all time" /> : null}
      </div>
      <span className="font-mono text-5xl tabular-nums leading-none text-primary">
        {formatShare({ part: source.orchestratedSessions, total: source.sessionCount })}
      </span>
      <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
        {strongest != null && strongest.count > 0
          ? `${source.orchestratedSessions} of ${source.sessionCount} sessions ran with a plan, a workflow, split work, or an in-app review. The strongest contributor is ${strongest.sentence}.`
          : `None of the ${source.sessionCount} sessions here used a plan, a workflow, split work, or an in-app review yet.`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {ranked.slice(0, 3).map((contributor) => (
          <Chip
            key={contributor.label}
            tone="primary"
            size="sm"
            label={`${contributor.count} ${contributor.label}`}
          />
        ))}
      </div>
    </div>
  );
};

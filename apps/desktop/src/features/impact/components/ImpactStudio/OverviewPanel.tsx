import type { ImpactOverview, PullRequestOutcomes, ReviewOutcomes } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { ErrorStrip, PanelLoading, SectionHeader, PaneShell } from '@goodboy/ui';
import type { QueryResult } from '../../../../shared/types/queryResult';
import type { ImpactTab } from '../../lib';
import { formatHours } from '../../utils/formatHours';
import { impactDelta } from '../../utils/impactDelta';
import { shippedSessions } from '../../utils/shippedSessions';
import { KpiTile } from './KpiTile';
import { OverviewEmpty } from './OverviewEmpty';
import { ShippedSessionRows } from './ShippedSessionRows';
import type { PaneFrame } from '../../../../shared/types/paneFrame';

type Props = {
  readonly frame: PaneFrame;
  readonly overview: QueryResult<ImpactOverview>;
  readonly pullRequests: QueryResult<PullRequestOutcomes>;
  readonly reviews: QueryResult<ReviewOutcomes>;
  readonly isLoading: boolean;
  readonly onRetryOverview: () => void;
  readonly onRetryShipped: () => void;
  readonly onSelectTab: (tab: ImpactTab) => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
  readonly onStartSession: () => void;
};

type ShareParams = {
  readonly sessions: number | null;
  readonly orchestrated: number | null;
};

const WORKFLOW_DEFINITION =
  'Sessions where a workflow, a subagent or a resolver did part of the work.';

const SHIPPED_LIMIT = 5;

const shareOf = ({ sessions, orchestrated }: ShareParams): number | null =>
  sessions === null || sessions === 0 ? null : (orchestrated ?? 0) / sessions;

export const OverviewPanel = ({
  frame,
  overview,
  pullRequests,
  reviews,
  isLoading,
  onRetryOverview,
  onRetryShipped,
  onSelectTab,
  onOpenSession,
  onStartSession,
}: Props) => {
  const data = overview.data;
  const prs = pullRequests.data;
  const reviewData = reviews.data;
  const share =
    data === null
      ? null
      : shareOf({ sessions: data.sessionCount, orchestrated: data.orchestratedSessions });
  const previousShare =
    data === null
      ? null
      : shareOf({
          sessions: data.previousSessionCount,
          orchestrated: data.previousOrchestratedSessions,
        });
  const shipped =
    prs === null || data === null
      ? []
      : shippedSessions({ entries: prs.entries, durations: data.sessions, limit: SHIPPED_LIMIT });

  return (
    <PaneShell scroll="body" {...frame}>
      <ErrorStrip label="overview" error={overview.error} onRetry={onRetryOverview} />
      <ErrorStrip
        label="pull request outcomes"
        error={pullRequests.error}
        onRetry={onRetryShipped}
      />
      <ErrorStrip label="review outcomes" error={reviews.error} onRetry={onRetryShipped} />
      {isLoading && data === null ? <PanelLoading label="Loading impact metrics" /> : null}
      {data !== null && data.sessionCount === 0 ? (
        <OverviewEmpty onStartSession={onStartSession} />
      ) : null}
      {data !== null && data.sessionCount > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiTile
              label="Sessions"
              value={String(data.sessionCount)}
              hint={
                data.deletedSessionCount > 0 ? `${data.deletedSessionCount} deleted` : undefined
              }
              delta={null}
              onSelect={() => onSelectTab('flow')}
            />
            <KpiTile
              label="Pull requests merged"
              value={String(prs?.merged ?? 0)}
              delta={impactDelta({
                current: prs?.merged ?? 0,
                previous: prs?.previousMerged ?? null,
                unit: 'count',
              })}
              onSelect={() => onSelectTab('shipped')}
            />
            <KpiTile
              label="Reviews resolved"
              value={String(reviewData?.commentsResolved ?? 0)}
              delta={impactDelta({
                current: reviewData?.commentsResolved ?? 0,
                previous: reviewData?.previousCommentsResolved ?? null,
                unit: 'count',
              })}
              onSelect={() => onSelectTab('shipped')}
            />
            <KpiTile
              label="Run by workflows"
              value={`${Math.round((share ?? 0) * 100)}%`}
              title={WORKFLOW_DEFINITION}
              delta={impactDelta({
                current: (share ?? 0) * 100,
                previous: previousShare === null ? null : previousShare * 100,
                unit: 'points',
              })}
              onSelect={() => onSelectTab('flow')}
            />
            <KpiTile
              label="Median session"
              value={formatHours({ hours: data.medianSessionHours })}
              delta={
                data.medianSessionHours === null
                  ? null
                  : impactDelta({
                      current: data.medianSessionHours,
                      previous: data.previousMedianSessionHours,
                      unit: 'hours',
                      isLowerBetter: true,
                    })
              }
              onSelect={() => onSelectTab('flow')}
            />
          </div>
          {shipped.length > 0 ? (
            <section className="flex flex-col gap-2">
              <SectionHeader label="Sessions that shipped the most" headingLevel={2} />
              <ShippedSessionRows sessions={shipped} onOpenSession={onOpenSession} />
            </section>
          ) : null}
        </>
      ) : null}
    </PaneShell>
  );
};

import type { ImpactOverview, PullRequestOutcomes, ReviewOutcomes } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import {
  Button,
  Notice,
  formatError,
  ErrorStrip,
  SkeletonRow,
  SectionHeader,
  PaneShell,
} from '@goodboy/ui';
import { loadStateOf } from '../../../../shared/lib/loadStateOf';
import type { QueryResult } from '../../../../shared/types/queryResult';
import type { ImpactTab } from '../../lib';
import { formatHours } from '../../utils/formatHours';
import { impactDelta } from '../../utils/impactDelta';
import { shippedSessions } from '../../utils/shippedSessions';
import { KpiTile } from './KpiTile';
import { OverviewEmpty } from './OverviewEmpty';
import { ShippedSessionRows } from './ShippedSessionRows';
import type { PaneFrame } from '../../../../shared/types/paneFrame';
import { NOT_LOADED_HINT, UNKNOWN_VALUE } from '../../../../shared/utils/unknownValue';
import { valueOrUnknown } from '../../../../shared/utils/valueOrUnknown';

type Props = {
  readonly frame: PaneFrame;
  readonly requestNoun: string;
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
  requestNoun,
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
  const loadState = loadStateOf({
    hasLoaded: data !== null,
    isLoading,
    error: overview.error,
    count: data?.sessionCount ?? 0,
  });
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
    <PaneShell scroll="body" page="impact" {...frame}>
      {overview.error === null ? null : (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title="Couldn't load impact metrics"
          body={formatError(overview.error)}
          detail={overview.error.message}
          actions={
            <Button size="sm" onClick={onRetryOverview}>
              Retry
            </Button>
          }
        />
      )}
      <ErrorStrip
        label="pull request outcomes"
        error={pullRequests.error}
        onRetry={onRetryShipped}
      />
      <ErrorStrip label="review outcomes" error={reviews.error} onRetry={onRetryShipped} />
      {loadState === 'loading' ? (
        <div aria-busy="true" className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((index) => (
            <SkeletonRow key={index} label="Loading impact metrics" />
          ))}
        </div>
      ) : null}
      {loadState === 'empty' ? <OverviewEmpty onStartSession={onStartSession} /> : null}
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
              label={`Merged ${requestNoun}`}
              value={valueOrUnknown({ value: prs?.merged })}
              {...(prs === null && { hint: NOT_LOADED_HINT })}
              delta={
                prs === null
                  ? null
                  : impactDelta({
                      current: prs.merged,
                      previous: prs.previousMerged,
                      unit: 'count',
                    })
              }
              onSelect={() => onSelectTab('shipped')}
            />
            <KpiTile
              label="Reviews resolved"
              value={valueOrUnknown({ value: reviewData?.commentsResolved })}
              {...(reviewData === null && { hint: NOT_LOADED_HINT })}
              delta={
                reviewData === null
                  ? null
                  : impactDelta({
                      current: reviewData.commentsResolved,
                      previous: reviewData.previousCommentsResolved,
                      unit: 'count',
                    })
              }
              onSelect={() => onSelectTab('shipped')}
            />
            <KpiTile
              label="Run by workflows"
              value={share === null ? UNKNOWN_VALUE : `${Math.round(share * 100)}%`}
              title={WORKFLOW_DEFINITION}
              delta={
                share === null
                  ? null
                  : impactDelta({
                      current: share * 100,
                      previous: previousShare === null ? null : previousShare * 100,
                      unit: 'points',
                    })
              }
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

import type { ExternalTaskOutcomes, PullRequestOutcomes, ReviewOutcomes } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { ArrowUpRight, GitPullRequest } from 'lucide-react';
import type { QueryResult } from '../../hooks/useImpactMetrics';
import { formatHours } from '../../utils/formatHours';
import { ErrorStrip } from './ErrorStrip';
import { PanelLoading } from './PanelLoading';
import { PanelShell } from './PanelShell';
import { SessionRows } from './SessionRows';
import { StackedBar } from './StackedBar';
import { TrendStatCard } from './TrendStatCard';
import { Widget } from './Widget';

type Props = {
  readonly pullRequests: QueryResult<PullRequestOutcomes>;
  readonly reviews: QueryResult<ReviewOutcomes>;
  readonly externalTasks: QueryResult<ExternalTaskOutcomes>;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const ShippedPanel = ({
  pullRequests,
  reviews,
  externalTasks,
  isLoading,
  onRetry,
  onOpenSession,
}: Props) => {
  const prs = pullRequests.data;
  const reviewData = reviews.data;
  const tasks = externalTasks.data;
  const totalReviews = reviewData?.resolutionDurationsHours.length ?? 0;
  const fastReviews = reviewData?.resolutionDurationsHours.filter((hours) => hours < 1).length ?? 0;
  const sameDayReviews =
    reviewData?.resolutionDurationsHours.filter((hours) => hours >= 1 && hours < 24).length ?? 0;
  const slowReviews = Math.max(totalReviews - fastReviews - sameDayReviews, 0);
  return (
    <PanelShell title="Shipped" subtitle="Pull requests, review throughput, and linked issues">
      <ErrorStrip label="pull requests" error={pullRequests.error} onRetry={onRetry} />
      <ErrorStrip label="review throughput" error={reviews.error} onRetry={onRetry} />
      <ErrorStrip label="linked issues" error={externalTasks.error} onRetry={onRetry} />
      {isLoading && prs === null && reviewData === null && tasks === null ? <PanelLoading /> : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TrendStatCard
          label="open PRs"
          value={String(prs?.open ?? 0)}
          current={prs?.open ?? 0}
          previous={prs?.previousOpen ?? null}
        />
        <TrendStatCard
          label="merged PRs"
          value={String(prs?.merged ?? 0)}
          current={prs?.merged ?? 0}
          previous={prs?.previousMerged ?? null}
        />
        <TrendStatCard
          label="reviews resolved"
          value={String(reviewData?.commentsResolved ?? 0)}
          current={reviewData?.commentsResolved ?? 0}
          previous={reviewData?.previousCommentsResolved ?? null}
        />
        <TrendStatCard
          label="median resolve"
          value={formatHours({ hours: reviewData?.medianResolveHours ?? null })}
          current={reviewData?.medianResolveHours ?? 0}
          previous={null}
          lowerIsBetter
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Widget label="PR funnel" hint="current cached state">
          <div className="flex flex-col gap-2">
            {prs?.entries.map((entry) => (
              <button
                key={`${entry.sessionId}-${entry.number}`}
                type="button"
                onClick={() => onOpenSession(entry.sessionId)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60"
              >
                <GitPullRequest size={13} aria-hidden className="shrink-0 text-success" />
                <span className="min-w-0 flex-1 truncate">
                  #{entry.number} {entry.title}
                </span>
                <span className="shrink-0 capitalize text-muted-foreground">{entry.state}</span>
                <ArrowUpRight size={12} aria-hidden />
              </button>
            ))}
            {prs !== null && prs.entries.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                No pull requests in this window.
              </span>
            ) : null}
          </div>
        </Widget>
        <Widget label="review throughput" hint="time from comment to resolution">
          <StackedBar
            segments={[
              {
                key: 'fast',
                tone: 'success',
                share: totalReviews > 0 ? (fastReviews / totalReviews) * 100 : 0,
                title: `${fastReviews} under one hour`,
              },
              {
                key: 'day',
                tone: 'warning',
                share: totalReviews > 0 ? (sameDayReviews / totalReviews) * 100 : 0,
                title: `${sameDayReviews} within one day`,
              },
              {
                key: 'slow',
                tone: 'danger',
                share: totalReviews > 0 ? (slowReviews / totalReviews) * 100 : 0,
                title: `${slowReviews} over one day`,
              },
            ]}
          />
          <div className="grid grid-cols-3 gap-2 text-center text-2xs text-muted-foreground">
            <span>&lt;1h {fastReviews}</span>
            <span>1h to 1d {sameDayReviews}</span>
            <span>&gt;1d {slowReviews}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="rounded-md bg-muted px-2 py-1.5 text-xs">
              Published drafts: {reviewData?.publishedDrafts ?? 0}
            </span>
            <span className="rounded-md bg-muted px-2 py-1.5 text-xs">
              Pushed resolutions: {reviewData?.pushedResolutions ?? 0}
            </span>
          </div>
        </Widget>
        <Widget label="hot files" hint="most resolved review comments">
          <div className="flex flex-col gap-1">
            {reviewData?.hotFiles.map((file) => (
              <div key={file.filePath} className="flex items-center gap-3 px-2 py-1 text-xs">
                <span className="min-w-0 flex-1 truncate font-mono">{file.filePath}</span>
                <span className="tabular-nums text-muted-foreground">{file.comments}</span>
              </div>
            ))}
          </div>
        </Widget>
        <Widget label="linked issues" hint="linked after launch vs launched from an issue">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-muted p-3">
              <span className="block text-2xs text-muted-foreground">linked</span>
              <span className="font-mono text-lg tabular-nums">{tasks?.linked ?? 0}</span>
            </div>
            <div className="rounded-md bg-muted p-3">
              <span className="block text-2xs text-muted-foreground">launched</span>
              <span className="font-mono text-lg tabular-nums">{tasks?.launched ?? 0}</span>
            </div>
          </div>
          <SessionRows
            sessions={tasks?.sessions ?? []}
            valueLabel=""
            formatValue={(value) => (value > 0 ? 'launched' : 'linked')}
            onOpenSession={onOpenSession}
          />
        </Widget>
      </div>
    </PanelShell>
  );
};

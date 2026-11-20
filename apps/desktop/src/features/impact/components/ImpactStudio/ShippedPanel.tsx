import type { ExternalTaskOutcomes, PullRequestOutcomes, ReviewOutcomes } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { ErrorStrip, PaneShell, EmptyState } from '@goodboy/ui';
import { PanelLoading } from '@goodboy/ui';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { formatHours } from '../../utils/formatHours';
import { PullRequestRow } from './PullRequestRow';
import { SessionRows } from './SessionRows';
import { StackedBar } from './StackedBar';
import { TrendStatCard } from './TrendStatCard';
import { StudioWidget } from '@goodboy/ui';
import { StatCard } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { PaneFrame } from '../../../../shared/types/paneFrame';
import { NOT_LOADED_HINT, UNKNOWN_VALUE } from '../../../../shared/utils/unknownValue';
import { valueOrUnknown } from '../../../../shared/utils/valueOrUnknown';

const FUNNEL_ROWS = 5;

type CountParams = {
  readonly count: number;
};

type Props = {
  readonly frame: PaneFrame;
  readonly requestNoun: string;
  readonly pullRequests: QueryResult<PullRequestOutcomes>;
  readonly reviews: QueryResult<ReviewOutcomes>;
  readonly externalTasks: QueryResult<ExternalTaskOutcomes>;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const ShippedPanel = ({
  frame,
  requestNoun,
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
  const reviewCount = ({ count }: CountParams): string =>
    valueOrUnknown({ value: reviewData === null ? null : count });
  return (
    <PaneShell scroll="body" page="impact" {...frame}>
      <ErrorStrip label="pull requests" error={pullRequests.error} onRetry={onRetry} />
      <ErrorStrip label="review throughput" error={reviews.error} onRetry={onRetry} />
      <ErrorStrip label="linked issues" error={externalTasks.error} onRetry={onRetry} />
      {isLoading && prs === null && reviewData === null && tasks === null ? (
        <PanelLoading label="Loading impact metrics" />
      ) : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TrendStatCard
          label={`Open ${requestNoun}`}
          value={valueOrUnknown({ value: prs?.open })}
          current={prs?.open ?? null}
          previous={prs?.previousOpen ?? null}
        />
        <TrendStatCard
          label={`Merged ${requestNoun}`}
          value={valueOrUnknown({ value: prs?.merged })}
          current={prs?.merged ?? null}
          previous={prs?.previousMerged ?? null}
        />
        <TrendStatCard
          label="Reviews resolved"
          value={valueOrUnknown({ value: reviewData?.commentsResolved })}
          current={reviewData?.commentsResolved ?? null}
          previous={reviewData?.previousCommentsResolved ?? null}
        />
        <TrendStatCard
          label="Median resolve"
          value={
            reviewData === null
              ? UNKNOWN_VALUE
              : formatHours({ hours: reviewData.medianResolveHours })
          }
          current={reviewData?.medianResolveHours ?? null}
          previous={null}
          lowerIsBetter
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StudioWidget label="PR funnel" hint="Latest known state">
          <div className="flex flex-col gap-2">
            {prs?.entries.slice(0, FUNNEL_ROWS).map((entry) => (
              <PullRequestRow
                key={`${entry.sessionId}-${entry.number}`}
                entry={entry}
                onOpenSession={onOpenSession}
              />
            ))}
            {prs !== null && prs.entries.length === 0 ? (
              <EmptyState
                size="section"
                icon={CONCEPT_ICONS.pr}
                tone={CONCEPT_TONE.pr}
                title={`No ${requestNoun} in this window`}
              />
            ) : null}
          </div>
        </StudioWidget>
        <StudioWidget label="Review throughput" hint="Time from comment to resolution">
          <StackedBar
            heading="Review throughput"
            segments={[
              {
                key: 'fast',
                tone: 'success',
                share: totalReviews > 0 ? (fastReviews / totalReviews) * 100 : 0,
                label: 'Under one hour',
                value: String(fastReviews),
              },
              {
                key: 'day',
                tone: 'warning',
                share: totalReviews > 0 ? (sameDayReviews / totalReviews) * 100 : 0,
                label: 'Within one day',
                value: String(sameDayReviews),
              },
              {
                key: 'slow',
                tone: 'danger',
                share: totalReviews > 0 ? (slowReviews / totalReviews) * 100 : 0,
                label: 'Over one day',
                value: String(slowReviews),
              },
            ]}
          />
          <div className="grid grid-cols-3 gap-2 text-center text-meta text-muted-foreground">
            <span>&lt;1h {reviewCount({ count: fastReviews })}</span>
            <span>1h to 1d {reviewCount({ count: sameDayReviews })}</span>
            <span>&gt;1d {reviewCount({ count: slowReviews })}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <span className="rounded-md bg-muted px-2 py-2 text-meta">
              Published drafts: {valueOrUnknown({ value: reviewData?.publishedDrafts })}
            </span>
            <span className="rounded-md bg-muted px-2 py-2 text-meta">
              Pushed resolutions: {valueOrUnknown({ value: reviewData?.pushedResolutions })}
            </span>
            <span className="rounded-md bg-muted px-2 py-2 text-meta">
              Sent to agent: {valueOrUnknown({ value: reviewData?.sentToAgent })}
            </span>
          </div>
        </StudioWidget>
        <StudioWidget label="Hot files" hint="Most resolved review comments">
          <div className="flex flex-col gap-1">
            {reviewData?.hotFiles.map((file) => (
              <div key={file.filePath} className="flex items-center gap-3 px-2 py-1 text-meta">
                <span className="min-w-0 flex-1 truncate font-mono">{file.filePath}</span>
                <span className="tabular-nums text-muted-foreground">{file.comments}</span>
              </div>
            ))}
          </div>
        </StudioWidget>
        <StudioWidget label="Linked issues" hint="Linked after launch vs launched from an issue">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Linked"
              value={valueOrUnknown({ value: tasks?.linked })}
              valueSize="lg"
              {...(tasks === null && { hint: NOT_LOADED_HINT })}
            />
            <StatCard
              label="Launched"
              value={valueOrUnknown({ value: tasks?.launched })}
              valueSize="lg"
              {...(tasks === null && { hint: NOT_LOADED_HINT })}
            />
          </div>
          <SessionRows
            sessions={tasks?.sessions ?? []}
            valueLabel=""
            formatValue={(value) => (value > 0 ? 'launched' : 'linked')}
            onOpenSession={onOpenSession}
          />
        </StudioWidget>
      </div>
    </PaneShell>
  );
};

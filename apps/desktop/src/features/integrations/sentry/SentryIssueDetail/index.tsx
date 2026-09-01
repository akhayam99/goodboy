import { StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { useState, type ReactNode } from 'react';
import { Skeleton, type SegmentedTabOption } from '@goodboy/ui';
import { Footprints, ListTree } from 'lucide-react';
import type { SentryIssueDetail as Detail } from '../client';
import { StudioWidget, HeaderBand, StudioDetailTabs } from '@goodboy/ui';
import { resolveDetailFields, sentryIssueFields } from '../../../../shared/detail-fields';
import { ErrorStrip } from '@goodboy/ui';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { SentryBreadcrumbs } from '../SentryBreadcrumbs';
import { SentryLevelBadge } from '../SentryLevelBadge';
import { SentryStackTrace } from '../SentryStackTrace';
import { sentryIssueView } from '../sentryIssueView';

type IssueSection = 'stack' | 'breadcrumbs';
type Fit = 'fill' | 'bleed' | 'flow';

type Props = {
  readonly identifier: string;
  readonly title: string;
  readonly culprit: string | null;
  readonly level: string | null;
  readonly status: string | null;
  readonly permalink: string | null;
  readonly count?: string | null;
  readonly userCount?: number | null;
  readonly firstSeen?: string | null;
  readonly lastSeen?: string | null;
  readonly detail: Detail | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly summaryIsLoading: boolean;
  readonly summaryError: string | null;
  readonly onRetrySummary: () => void;
  readonly headerActions?: ReactNode;
  readonly fit?: Fit;
};

export const SentryIssueDetail = ({
  identifier,
  title,
  culprit,
  level,
  status,
  permalink,
  count = null,
  userCount = null,
  firstSeen = null,
  lastSeen = null,
  detail,
  isLoading,
  error,
  summaryIsLoading,
  summaryError,
  onRetrySummary,
  headerActions,
  fit = 'fill',
}: Props) => {
  const [section, setSection] = useState<IssueSection>('stack');
  const view = sentryIssueView({
    identifier,
    title,
    culprit,
    level,
    status,
    permalink,
    count,
    userCount,
    firstSeen,
    lastSeen,
    detail,
    isLoading,
    error,
  });

  const options: ReadonlyArray<SegmentedTabOption<IssueSection>> = [
    { value: 'stack', label: 'Stack trace', icon: ListTree },
    ...(view.hasBreadcrumbs
      ? [
          {
            value: 'breadcrumbs' as const,
            label: 'Breadcrumbs',
            icon: Footprints,
            badge: String(view.breadcrumbCount),
          },
        ]
      : []),
  ];
  const activeSection = options.some((option) => option.value === section) ? section : 'stack';

  return (
    <StudioDetailLayout
      fit={fit}
      header={
        <HeaderBand
          title={view.title}
          meta={
            <>
              <SentryLevelBadge level={view.level} />
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {view.identifier}
              </span>
            </>
          }
          actions={
            <>
              {headerActions}
              {view.permalink != null && view.permalink !== '' ? (
                <ExternalRefActions url={view.permalink} label="issue" hostLabel="Sentry" />
              ) : null}
            </>
          }
        />
      }
      tabs={
        <StudioDetailTabs
          ariaLabel="Issue sections"
          value={activeSection}
          onChange={setSection}
          options={options}
        />
      }
      properties={resolveDetailFields({ registry: sentryIssueFields, entity: view })}
    >
      {summaryIsLoading ? (
        <div
          role="status"
          aria-label="Loading Sentry issue details"
          className="flex flex-col gap-2"
        >
          <Skeleton className="h-3 w-1/2 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      ) : null}
      {summaryError != null ? (
        <ErrorStrip
          label="the Sentry issue details"
          error={new Error(summaryError)}
          onRetry={onRetrySummary}
        />
      ) : null}
      {activeSection === 'stack' ? (
        <StudioWidget presentation="section" label="stack trace">
          <SentryStackTrace frames={view.frames} isLoading={isLoading} error={error} />
        </StudioWidget>
      ) : (
        <StudioWidget presentation="section" label="breadcrumbs">
          <SentryBreadcrumbs breadcrumbs={view.breadcrumbs} isLoading={isLoading} error={error} />
        </StudioWidget>
      )}
    </StudioDetailLayout>
  );
};

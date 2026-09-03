import { RecordDetailHeader, StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { useState, type ReactNode } from 'react';
import { EmptyState, Skeleton, StatCard, type SegmentedTabOption } from '@goodboy/ui';
import { Footprints, LayoutList, ListTree } from 'lucide-react';
import type { SentryIssueDetail as Detail } from '../client';
import { StudioWidget, StudioDetailTabs } from '@goodboy/ui';
import { resolveDetailFields, sentryIssueFields } from '../../../../shared/detail-fields';
import { ErrorStrip } from '@goodboy/ui';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { SentryBreadcrumbs } from '../SentryBreadcrumbs';
import { SentryLevelBadge } from '../SentryLevelBadge';
import { SentryStackTrace } from '../SentryStackTrace';
import { sentryIssueView } from '../sentryIssueView';

type IssueSection = 'overview' | 'stack' | 'breadcrumbs';
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
  readonly dock?: ReactNode;
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
  dock,
  fit = 'fill',
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
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
    { value: 'overview', label: 'Overview', icon: LayoutList },
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
  const selectedSection = options.some((option) => option.value === section) ? section : 'overview';
  const activeSection =
    selectedSection === 'overview' && (summaryIsLoading || summaryError != null)
      ? 'stack'
      : selectedSection;
  const formattedFirstSeen =
    view.firstSeen == null || view.firstSeen === ''
      ? ''
      : formatAbsoluteDateTime({ iso: view.firstSeen });
  const formattedLastSeen =
    view.lastSeen == null || view.lastSeen === ''
      ? ''
      : formatAbsoluteDateTime({ iso: view.lastSeen });
  const stats = [
    ...(view.count != null ? [{ label: 'Events', value: view.count }] : []),
    ...(view.userCount != null ? [{ label: 'Users', value: String(view.userCount) }] : []),
    ...(formattedFirstSeen !== '' ? [{ label: 'First seen', value: formattedFirstSeen }] : []),
    ...(formattedLastSeen !== '' ? [{ label: 'Last seen', value: formattedLastSeen }] : []),
  ];

  return (
    <StudioDetailLayout
      fit={fit}
      header={
        <RecordDetailHeader
          provider="sentry"
          identifier={view.identifier}
          title={view.title}
          badge={<SentryLevelBadge level={view.level} />}
          actions={headerActions}
          externalRef={
            view.permalink != null && view.permalink !== ''
              ? { url: view.permalink, label: 'issue' }
              : null
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
      dock={dock}
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
      {activeSection === 'overview' ? (
        stats.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} valueSize="lg" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CONCEPT_ICONS.sentry}
            tone={CONCEPT_TONE.sentry}
            title="No event stats yet"
            size="inline"
          />
        )
      ) : null}
      {activeSection === 'stack' ? (
        <StudioWidget presentation="section" label="stack trace">
          <SentryStackTrace frames={view.frames} isLoading={isLoading} error={error} />
        </StudioWidget>
      ) : null}
      {activeSection === 'breadcrumbs' ? (
        <StudioWidget presentation="section" label="breadcrumbs">
          <SentryBreadcrumbs breadcrumbs={view.breadcrumbs} isLoading={isLoading} error={error} />
        </StudioWidget>
      ) : null}
    </StudioDetailLayout>
  );
};

import { useEffect, useState } from 'react';
import { EmptyState, StatCard, type SegmentedTabOption } from '@goodboy/ui';
import { Footprints, LayoutList, ListTree } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import {
  HeaderBand,
  StudioDetailLayout,
  StudioDetailTabs,
} from '../../../../shared/components/StudioDetail';
import { resolveDetailFields, sentryIssueFields } from '../../../../shared/detail-fields';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { LaunchSessionPanel } from '../../../integrations/components/LaunchSessionPanel';
import { goalFromSentry } from '../goal-from-sentry';
import type { SentryIssue } from '../client';
import { SentryBreadcrumbs } from '../SentryBreadcrumbs';
import { SentryLevelBadge } from '../SentryLevelBadge';
import { SentryStackTrace } from '../SentryStackTrace';
import { sentryIssueView } from '../sentryIssueView';
import { useSentryIssueDetail } from '../useSentryIssueDetail';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly issue: SentryIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

type IssueSection = 'overview' | 'stack' | 'breadcrumbs';

const SLUG_MAX_LEN = 30;

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const {
    detail,
    isLoading: detailLoading,
    error: detailError,
  } = useSentryIssueDetail({
    workspaceId,
    issueId: issue?.id ?? null,
  });
  const issueDetail = detail != null && detail.issueId === issue?.id ? detail : null;

  useEffect(() => {
    setSection('overview');
  }, [issue?.id]);

  if (!issue) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.sentry}
          icon={CONCEPT_ICONS.sentry}
          title="No issue selected"
          description="Pick an issue to see its stack trace and launch a session."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  const launch = (
    <LaunchSessionPanel
      key={issue.id}
      workspaceId={workspaceId}
      linkedSessionId={sessionId}
      goalSeed={goalFromSentry(issue, issueDetail)}
      branchSlugSeed={slugifyBranch({ input: issue.title, maxLength: SLUG_MAX_LEN })}
      externalTask={{
        provider: 'sentry',
        externalId: issue.id,
        identifier: issue.shortId ?? issue.id,
        url: issue.permalink ?? '',
        title: issue.title,
      }}
      onClose={onClose}
    />
  );

  const view = sentryIssueView({
    identifier: issue.shortId ?? issue.id,
    title: issue.title,
    level: issue.level,
    culprit: issue.culprit,
    status: issue.status,
    permalink: issue.permalink,
    detail: issueDetail,
    isLoading: detailLoading,
    error: detailError,
  });
  const firstSeen = issue.firstSeen == null ? '' : formatAbsoluteDateTime({ iso: issue.firstSeen });
  const lastSeen = issue.lastSeen == null ? '' : formatAbsoluteDateTime({ iso: issue.lastSeen });
  const stats = [
    ...(issue.count != null ? [{ label: 'Events', value: issue.count }] : []),
    ...(issue.userCount != null ? [{ label: 'Users', value: String(issue.userCount) }] : []),
    ...(firstSeen !== '' ? [{ label: 'First seen', value: firstSeen }] : []),
    ...(lastSeen !== '' ? [{ label: 'Last seen', value: lastSeen }] : []),
  ];

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
  const activeSection = options.some((option) => option.value === section) ? section : 'overview';

  return (
    <StudioDetailLayout
      header={
        <HeaderBand
          meta={
            <>
              <SentryLevelBadge level={view.level} />
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {view.identifier}
              </span>
            </>
          }
          title={view.title}
          actions={
            view.permalink != null && view.permalink !== '' ? (
              <ExternalRefActions url={view.permalink} label="issue" hostLabel="Sentry" />
            ) : undefined
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
      rail={launch}
      properties={resolveDetailFields({ registry: sentryIssueFields, entity: view })}
    >
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
        <div className="rounded-lg border border-border-soft bg-muted/10 p-4">
          <SentryStackTrace frames={view.frames} isLoading={detailLoading} error={detailError} />
        </div>
      ) : null}

      {activeSection === 'breadcrumbs' ? (
        <div className="rounded-lg border border-border-soft bg-muted/10 p-4">
          <SentryBreadcrumbs
            breadcrumbs={view.breadcrumbs}
            isLoading={detailLoading}
            error={detailError}
          />
        </div>
      ) : null}
    </StudioDetailLayout>
  );
};

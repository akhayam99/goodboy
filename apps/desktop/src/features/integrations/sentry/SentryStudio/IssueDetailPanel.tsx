import { Divider, EmptyState, StatCard } from '@goodboy/ui';
import { ListTree, MousePointerClick } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import {
  DetailSection,
  HeaderBand,
  MetaItem,
  StudioDetailLayout,
} from '../../../../shared/components/StudioDetail';
import { OpenExternalLink } from '../../../../shared/components/OpenExternalLink';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { LaunchSessionPanel } from '../../../integrations/components/LaunchSessionPanel';
import { goalFromSentry } from '../goal-from-sentry';
import type { SentryIssue } from '../client';
import { SentryBreadcrumbs } from '../SentryBreadcrumbs';
import { SentryLevelBadge } from '../SentryLevelBadge';
import { SentryStackTrace } from '../SentryStackTrace';
import { sentryIssueView } from '../sentryIssueView';
import { useSentryIssueDetail } from '../useSentryIssueDetail';

type Props = {
  readonly issue: SentryIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

const SLUG_MAX_LEN = 30;

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  const {
    detail,
    isLoading: detailLoading,
    error: detailError,
  } = useSentryIssueDetail({
    workspaceId,
    issueId: issue?.id ?? null,
  });
  const issueDetail = detail != null && detail.issueId === issue?.id ? detail : null;

  if (!issue) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          icon={MousePointerClick}
          title="No issue selected"
          description="Pick an issue to see its stack trace and launch a session."
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
    permalink: issue.permalink,
    detail: issueDetail,
    isLoading: detailLoading,
    error: detailError,
  });
  const firstSeen = issue.firstSeen == null ? '' : formatRelativeDuration(issue.firstSeen);
  const lastSeen = issue.lastSeen == null ? '' : formatRelativeDuration(issue.lastSeen);
  const stats = [
    ...(issue.count != null ? [{ label: 'Events', value: issue.count }] : []),
    ...(issue.userCount != null ? [{ label: 'Users', value: String(issue.userCount) }] : []),
    ...(firstSeen !== '' ? [{ label: 'First seen', value: `${firstSeen} ago` }] : []),
    ...(lastSeen !== '' ? [{ label: 'Last seen', value: `${lastSeen} ago` }] : []),
  ];

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
          subtitle={
            view.culprit != null ? (
              <span className="truncate font-mono text-2xs text-muted-foreground">
                {view.culprit}
              </span>
            ) : undefined
          }
          actions={
            view.permalink != null && view.permalink !== '' ? (
              <OpenExternalLink url={view.permalink} label="Open in Sentry" copyLabel="issue" />
            ) : undefined
          }
        />
      }
      rail={
        <>
          {launch}
          <Divider />
          {view.tags.map((tag) => (
            <MetaItem key={tag.key} label={tag.key}>
              {tag.value}
            </MetaItem>
          ))}
          {issue.status != null ? <MetaItem label="Status">{issue.status}</MetaItem> : null}
        </>
      }
    >
      {stats.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} valueSize="lg" />
          ))}
        </div>
      ) : null}

      <DetailSection
        label="stack trace"
        icon={<ListTree size={13} aria-hidden className="text-muted-foreground" />}
      >
        <SentryStackTrace frames={view.frames} isLoading={detailLoading} error={detailError} />
      </DetailSection>

      {view.hasBreadcrumbs ? (
        <DetailSection label="breadcrumbs">
          <SentryBreadcrumbs
            breadcrumbs={view.breadcrumbs}
            isLoading={detailLoading}
            error={detailError}
          />
        </DetailSection>
      ) : null}
    </StudioDetailLayout>
  );
};

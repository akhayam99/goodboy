import { Divider, EmptyState, StatCard, cn } from '@goodboy/ui';
import { ExternalLink, Layers, MousePointerClick } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import {
  DetailSection,
  HeaderBand,
  MetaItem,
  StudioDetailLayout,
} from '../../../../shared/components/StudioDetail';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { LaunchSessionPanel } from '../../../integrations/components/LaunchSessionPanel';
import { goalFromSentry } from '../goal-from-sentry';
import type { SentryIssue } from '../client';
import { levelTone } from '../levelTone';
import { SentryBreadcrumbs } from '../SentryBreadcrumbs';
import { SentryStackTrace } from '../SentryStackTrace';
import { useSentryIssueDetail } from '../useSentryIssueDetail';
import { visibleSentryTags } from '../visibleSentryTags';

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

  const identifier = issue.shortId ?? issue.id;
  const culprit = issueDetail?.culprit ?? issue.culprit;
  const permalink = issue.permalink;
  const visibleTags = visibleSentryTags({ detail: issueDetail });
  const frames = issueDetail?.frames ?? [];
  const breadcrumbs = issueDetail?.breadcrumbs ?? [];
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
              <span
                className={cn(
                  'shrink-0 rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide',
                  levelTone({ level: issue.level }),
                )}
              >
                {issue.level ?? 'error'}
              </span>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {identifier}
              </span>
            </>
          }
          title={issueDetail?.title ?? issue.title}
          subtitle={
            culprit != null ? (
              <span className="truncate font-mono text-2xs text-muted-foreground">{culprit}</span>
            ) : undefined
          }
          actions={
            permalink != null && permalink !== '' ? (
              <a
                href={permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Open in Sentry <ExternalLink size={11} aria-hidden />
              </a>
            ) : undefined
          }
        />
      }
      rail={
        <>
          {launch}
          <Divider />
          {visibleTags.map((tag) => (
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
        icon={<Layers size={13} aria-hidden className="text-muted-foreground" />}
      >
        <SentryStackTrace frames={frames} isLoading={detailLoading} error={detailError} />
      </DetailSection>

      <SentryBreadcrumbs breadcrumbs={breadcrumbs} isLoading={detailLoading} error={detailError} />
    </StudioDetailLayout>
  );
};

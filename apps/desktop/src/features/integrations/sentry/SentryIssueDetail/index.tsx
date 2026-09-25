import { PaneShell } from '../../../../shared/components/PaneShell';
import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import { RecordFacts } from '../../../../shared/components/StudioDetail/RecordFacts';
import { RecordSections } from '../../../../shared/components/StudioDetail/RecordSections';
import type { RecordSection } from '../../../../shared/components/StudioDetail/RecordSections/types';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import { ErrorStrip, Skeleton, StateBadge } from '@goodboy/ui';
import type { SentryIssueDetail as Detail } from '../client';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { resolveFacts, sentryIssueFields } from '../../../../shared/detail-fields';
import { stateWord } from '../../../inbox/stateWord';
import { SentryBreadcrumbs } from '../SentryBreadcrumbs';
import { SentryStackTrace } from '../SentryStackTrace';
import { sentryIssueView } from '../sentryIssueView';

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
  readonly summaryIsLoading?: boolean;
  readonly summaryError?: string | null;
  readonly onRetrySummary?: () => void;
  readonly frame?: RecordFrame | null;
};

type DescriptionParams = {
  readonly culprit: string | null;
};

const descriptionOf = ({ culprit }: DescriptionParams): string =>
  culprit == null || culprit.trim() === '' ? '' : `Raised in \`${culprit}\`.`;

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
  summaryIsLoading = false,
  summaryError = null,
  onRetrySummary,
  frame = null,
}: Props) => {
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

  const sections: ReadonlyArray<RecordSection> = [
    {
      key: 'description',
      kind: 'description',
      label: 'Description',
      isCollapsible: false,
      defaultOpen: true,
      content: <DescriptionSection text={descriptionOf({ culprit: view.culprit })} />,
    },
    {
      key: 'stack',
      kind: 'tool',
      label: 'Stack trace',
      summary: view.frames.length === 0 ? undefined : `${view.frames.length} frames`,
      isCollapsible: true,
      defaultOpen: true,
      content: <SentryStackTrace frames={view.frames} isLoading={isLoading} error={error} />,
    },
    ...(view.hasBreadcrumbs
      ? [
          {
            key: 'breadcrumbs',
            kind: 'tool' as const,
            label: 'Breadcrumbs',
            count: view.breadcrumbCount,
            isCollapsible: true,
            defaultOpen: false,
            content: (
              <SentryBreadcrumbs
                breadcrumbs={view.breadcrumbs}
                isLoading={isLoading}
                error={error}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <PaneShell
      scroll="body"
      header={
        <RecordHeader
          provider="sentry"
          identifier={view.identifier}
          title={view.title}
          state={<StateBadge>{stateWord({ value: view.status ?? 'unresolved' })}</StateBadge>}
          facts={
            <RecordFacts facts={resolveFacts({ registry: sentryIssueFields, entity: view })} />
          }
          frame={frame}
          externalRef={
            view.permalink != null && view.permalink !== ''
              ? { url: view.permalink, label: 'issue' }
              : null
          }
        />
      }
    >
      {summaryIsLoading ? (
        <div
          role="status"
          aria-label="Loading Sentry issue details"
          className="flex flex-col gap-2"
        >
          <Skeleton className="h-3 w-1/2 rounded-sm" />
          <Skeleton className="h-3 w-1/3 rounded-sm" />
        </div>
      ) : null}
      {summaryError != null && onRetrySummary !== undefined ? (
        <ErrorStrip
          label="the Sentry issue details"
          error={new Error(summaryError)}
          onRetry={onRetrySummary}
        />
      ) : null}
      <RecordSections sections={sections} />
    </PaneShell>
  );
};

import { useState } from 'react';
import type { SegmentedTabOption } from '@goodboy/ui';
import { Footprints, ListTree } from 'lucide-react';
import type { SentryIssueDetail as Detail } from '../client';
import {
  DetailSection,
  HeaderBand,
  StudioDetailLayout,
  StudioDetailTabs,
} from '../../../../shared/components/StudioDetail';
import { resolveDetailFields, sentryIssueFields } from '../../../../shared/detail-fields';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { SentryBreadcrumbs } from '../SentryBreadcrumbs';
import { SentryLevelBadge } from '../SentryLevelBadge';
import { SentryStackTrace } from '../SentryStackTrace';
import { sentryIssueView } from '../sentryIssueView';

type IssueSection = 'stack' | 'breadcrumbs';

type Props = {
  readonly identifier: string;
  readonly title: string;
  readonly culprit: string | null;
  readonly level: string | null;
  readonly status: string | null;
  readonly permalink: string | null;
  readonly detail: Detail | null;
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const SentryIssueDetail = ({
  identifier,
  title,
  culprit,
  level,
  status,
  permalink,
  detail,
  isLoading,
  error,
}: Props) => {
  const [section, setSection] = useState<IssueSection>('stack');
  const view = sentryIssueView({
    identifier,
    title,
    culprit,
    level,
    status,
    permalink,
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
      fit="flow"
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
      properties={resolveDetailFields({ registry: sentryIssueFields, entity: view })}
    >
      {activeSection === 'stack' ? (
        <DetailSection label="stack trace">
          <SentryStackTrace frames={view.frames} isLoading={isLoading} error={error} />
        </DetailSection>
      ) : (
        <DetailSection label="breadcrumbs">
          <SentryBreadcrumbs breadcrumbs={view.breadcrumbs} isLoading={isLoading} error={error} />
        </DetailSection>
      )}
    </StudioDetailLayout>
  );
};

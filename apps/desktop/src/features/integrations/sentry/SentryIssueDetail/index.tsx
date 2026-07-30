import { DetailPage, MetaGrid, type DetailSection, type MetaItem } from '@goodboy/ui';
import type { SentryIssueDetail as Detail } from '../client';
import { OpenExternalLink } from '../../../../shared/components/OpenExternalLink';
import { SentryBreadcrumbs } from '../SentryBreadcrumbs';
import { SentryLevelBadge } from '../SentryLevelBadge';
import { SentryStackTrace } from '../SentryStackTrace';
import { sentryIssueView } from '../sentryIssueView';

type Props = {
  readonly identifier: string;
  readonly title: string;
  readonly culprit: string | null;
  readonly level: string | null;
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
  permalink,
  detail,
  isLoading,
  error,
}: Props) => {
  const view = sentryIssueView({
    identifier,
    title,
    culprit,
    level,
    permalink,
    detail,
    isLoading,
    error,
  });

  const meta: ReadonlyArray<MetaItem> = [
    {
      label: 'Culprit',
      wide: true,
      value:
        view.culprit != null ? <span className="font-mono text-2xs">{view.culprit}</span> : null,
    },
    ...view.tags.map((tag) => ({ label: tag.key, value: tag.value })),
  ];

  const sections: ReadonlyArray<DetailSection> = [
    {
      id: 'stack-trace',
      title: 'Stack trace',
      children: <SentryStackTrace frames={view.frames} isLoading={isLoading} error={error} />,
    },
    ...(view.hasBreadcrumbs
      ? [
          {
            id: 'breadcrumbs',
            title: view.breadcrumbsLabel,
            defaultCollapsed: true,
            children: (
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
    <DetailPage
      eyebrow={view.identifier}
      title={view.title}
      state={<SentryLevelBadge level={view.level} />}
      actions={
        view.permalink != null && view.permalink !== '' ? (
          <OpenExternalLink url={view.permalink} label="Open in Sentry" />
        ) : undefined
      }
      meta={<MetaGrid items={meta} />}
      sections={sections}
    />
  );
};

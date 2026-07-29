import { DetailPage, MetaGrid, type DetailSection, type MetaItem } from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import type { SentryIssueDetail as Detail } from '../client';
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
          <a
            href={view.permalink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Open in Sentry <ExternalLink size={11} aria-hidden />
          </a>
        ) : undefined
      }
      meta={<MetaGrid items={meta} />}
      sections={sections}
    />
  );
};

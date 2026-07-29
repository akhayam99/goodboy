import { DetailPage, MetaGrid, cn, type DetailSection, type MetaItem } from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import type { SentryIssueDetail as Detail } from '../client';
import { levelTone } from '../levelTone';
import { SentryBreadcrumbs } from '../SentryBreadcrumbs';
import { SentryStackTrace } from '../SentryStackTrace';
import { visibleSentryTags } from '../visibleSentryTags';

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
  const visibleTags = visibleSentryTags({ detail });
  const frames = detail?.frames ?? [];
  const breadcrumbs = detail?.breadcrumbs ?? [];
  const resolvedCulprit = detail?.culprit ?? culprit;

  const meta: ReadonlyArray<MetaItem> = [
    {
      label: 'Culprit',
      wide: true,
      value:
        resolvedCulprit != null ? (
          <span className="font-mono text-2xs">{resolvedCulprit}</span>
        ) : null,
    },
    ...visibleTags.map((tag) => ({ label: tag.key, value: tag.value })),
  ];

  const sections: ReadonlyArray<DetailSection> = [
    {
      id: 'stack-trace',
      title: 'Stack trace',
      children: <SentryStackTrace frames={frames} isLoading={isLoading} error={error} />,
    },
    ...(breadcrumbs.length > 0 && !isLoading && error == null
      ? [
          {
            id: 'breadcrumbs',
            title: `Breadcrumbs (${breadcrumbs.length})`,
            defaultCollapsed: true,
            children: (
              <SentryBreadcrumbs breadcrumbs={breadcrumbs} isLoading={isLoading} error={error} />
            ),
          },
        ]
      : []),
  ];

  return (
    <DetailPage
      eyebrow={identifier}
      title={detail?.title ?? title}
      state={
        <span
          className={cn(
            'shrink-0 rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide',
            levelTone({ level }),
          )}
        >
          {level ?? 'error'}
        </span>
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
      meta={<MetaGrid items={meta} />}
      sections={sections}
    />
  );
};

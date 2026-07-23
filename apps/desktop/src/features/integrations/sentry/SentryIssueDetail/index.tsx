import { SectionHeader, cn } from '@goodboy/ui';
import { ExternalLink, Layers } from 'lucide-react';
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

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'shrink-0 rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide',
              levelTone({ level }),
            )}
          >
            {level ?? 'error'}
          </span>
          <span className="font-mono text-2xs tabular-nums text-muted-foreground">
            {identifier}
          </span>
          <span className="flex-1" />
          {permalink != null && permalink !== '' ? (
            <a
              href={permalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Open in Sentry <ExternalLink size={11} aria-hidden />
            </a>
          ) : null}
        </div>
        <h2 className="text-lg font-semibold leading-snug text-foreground">
          {detail?.title ?? title}
        </h2>
        {detail?.culprit != null || culprit != null ? (
          <span className="truncate font-mono text-2xs text-muted-foreground">
            {detail?.culprit ?? culprit}
          </span>
        ) : null}
        {visibleTags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {visibleTags.map((tag) => (
              <span
                key={tag.key}
                className="rounded-md border border-border-soft bg-muted/30 px-2 py-1 text-2xs text-muted-foreground"
              >
                {tag.key}: <span className="text-foreground">{tag.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <section className="flex flex-col gap-3">
        <SectionHeader
          label="stack trace"
          icon={<Layers size={13} aria-hidden className="text-muted-foreground" />}
        />
        <SentryStackTrace frames={frames} isLoading={isLoading} error={error} />
      </section>

      <SentryBreadcrumbs breadcrumbs={breadcrumbs} isLoading={isLoading} error={error} />
    </article>
  );
};

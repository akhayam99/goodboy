import { SectionHeader, Skeleton, cn } from '@goodboy/ui';
import { ExternalLink, Layers } from 'lucide-react';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import type { SentryIssueDetail as Detail } from '../client';
import { levelTone } from '../levelTone';

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

const VISIBLE_TAGS = new Set(['release', 'environment']);

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
  const visibleTags = detail?.tags?.filter((tag) => VISIBLE_TAGS.has(tag.key)) ?? [];
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
        {isLoading ? (
          <div
            role="status"
            aria-label="Loading latest event"
            className="flex flex-col gap-2 rounded-lg border border-border-soft bg-subtle/40 p-3"
          >
            {['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-2/5', 'w-3/5'].map((width) => (
              <Skeleton key={width} className={cn('h-2.5 rounded', width)} />
            ))}
          </div>
        ) : error != null ? (
          <p className="text-sm text-danger">{error}</p>
        ) : frames.length > 0 ? (
          <pre className="overflow-x-auto rounded-lg border border-border-soft bg-subtle/40 p-3 font-mono text-2xs leading-relaxed text-muted-foreground">
            {frames
              .map(
                (frame) =>
                  `${frame.in_app ? '› ' : '  '}${frame.function ?? '?'} (${frame.filename ?? '?'}${
                    frame.line_no != null ? `:${frame.line_no}` : ''
                  })`,
              )
              .join('\n')}
          </pre>
        ) : (
          <p className="text-sm italic text-muted-foreground/60">No stack trace available.</p>
        )}
      </section>

      {!isLoading && error == null && breadcrumbs.length > 0 ? (
        <details className="rounded-lg border border-border-soft bg-muted/10">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
            Breadcrumbs ({breadcrumbs.length})
          </summary>
          <div className="flex flex-col gap-2 px-3 pb-3">
            {breadcrumbs.map((breadcrumb, index) => {
              const relativeDate =
                breadcrumb.timestamp == null ? '' : formatRelativeDuration(breadcrumb.timestamp);
              return (
                <div
                  key={`${breadcrumb.timestamp ?? 'breadcrumb'}-${index}`}
                  className="flex flex-col gap-1 rounded-md bg-muted/30 p-2"
                >
                  <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {breadcrumb.category ?? 'event'}
                    </span>
                    {breadcrumb.level != null ? <span>{breadcrumb.level}</span> : null}
                    {relativeDate !== '' ? <span>{relativeDate} ago</span> : null}
                  </div>
                  {breadcrumb.message != null ? (
                    <span className="text-xs text-muted-foreground">{breadcrumb.message}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </article>
  );
};

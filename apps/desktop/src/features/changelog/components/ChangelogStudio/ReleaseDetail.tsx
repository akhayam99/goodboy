import { Button, EmptyState, Markdown, Skeleton, SkeletonText } from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ErrorStrip } from '../../../../shared/components/ErrorStrip';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { openUrl } from '../../../../shared/lib/editor';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import type { ReleaseNote } from '../../changelog';
import { formatReleaseDate } from '../../formatReleaseDate';
import type { ChangelogView } from '../../resolveChangelogView';

type Props = {
  readonly release: ReleaseNote | null;
  readonly view: ChangelogView;
  readonly staleError: Error | null;
  readonly staleSince: string | null;
  readonly onRetry: () => void;
};

export const ReleaseDetail = ({ release, view, staleError, staleSince, onRetry }: Props) => {
  const subtitle =
    view === 'ready' && release != null
      ? formatReleaseDate({ iso: release.publishedAt, style: 'full' })
      : undefined;
  const action =
    view === 'ready' && release != null ? (
      <Button size="sm" variant="secondary" onClick={() => void openUrl(release.htmlUrl)}>
        <ExternalLink size={12} aria-hidden />
        Open on GitHub
      </Button>
    ) : undefined;

  return (
    <StudioPanel title={release?.version ?? 'Release notes'} subtitle={subtitle} action={action}>
      {view === 'loading' ? (
        <div className="flex flex-col gap-5" role="status" aria-label="Loading releases">
          <Skeleton className="h-6 w-36" />
          <SkeletonText lines={7} />
        </div>
      ) : null}
      {view === 'failed' ? (
        <EmptyState
          bordered
          size="lg"
          headingLevel={2}
          icon={CONCEPT_ICONS.changelog}
          tone={CONCEPT_TONE.changelog}
          title="Couldn't load releases"
          description="Check your connection and retry"
          action={
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      ) : null}
      {view === 'empty' ? (
        <EmptyState
          bordered
          size="lg"
          headingLevel={2}
          icon={CONCEPT_ICONS.changelog}
          tone={CONCEPT_TONE.changelog}
          title="No published releases yet"
          description="Release notes appear here once the first version ships"
        />
      ) : null}
      {view === 'ready' && release != null ? (
        <>
          {staleError != null ? (
            <div className="flex flex-col gap-1.5">
              <ErrorStrip label="the latest releases" error={staleError} onRetry={onRetry} />
              {staleSince != null && (
                <span className="text-2xs text-muted-foreground">
                  last updated {formatRelativeAge({ fromIso: staleSince })}
                </span>
              )}
            </div>
          ) : null}
          {release.body.trim() === '' ? (
            <p className="text-sm italic text-muted-foreground/60">no notes for this release.</p>
          ) : (
            <Markdown text={release.body} className="text-sm leading-relaxed" />
          )}
        </>
      ) : null}
    </StudioPanel>
  );
};

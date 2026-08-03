import { Button, EmptyState, Markdown, Skeleton, SkeletonText } from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ErrorStrip } from '../../../../shared/components/ErrorStrip';
import { HeaderBand, StudioDetailLayout } from '../../../../shared/components/StudioDetail';
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
  if (view === 'loading') {
    return (
      <div className="flex flex-col gap-5 px-6 py-6" role="status" aria-label="Loading releases">
        <Skeleton className="h-6 w-36" />
        <SkeletonText lines={7} />
      </div>
    );
  }

  if (view === 'failed') {
    return (
      <div className="px-6 py-6">
        <EmptyState
          bordered
          size="inline"
          icon={CONCEPT_ICONS.changelog}
          tone={CONCEPT_TONE.changelog}
          title="couldn't load releases"
          description="check your connection and retry"
          action={
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (release == null) {
    return (
      <div className="px-6 py-6">
        <EmptyState
          bordered
          size="inline"
          icon={CONCEPT_ICONS.changelog}
          tone={CONCEPT_TONE.changelog}
          title="no published releases yet"
          description="release notes appear here once the first version ships"
        />
      </div>
    );
  }

  return (
    <StudioDetailLayout
      header={
        <HeaderBand
          meta={
            <span className="text-2xs tabular-nums text-muted-foreground">
              {formatReleaseDate({ iso: release.publishedAt, style: 'full' })}
            </span>
          }
          title={release.version}
          actions={
            <Button size="sm" variant="secondary" onClick={() => void openUrl(release.htmlUrl)}>
              <ExternalLink size={12} aria-hidden />
              Open on GitHub
            </Button>
          }
        />
      }
    >
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
    </StudioDetailLayout>
  );
};

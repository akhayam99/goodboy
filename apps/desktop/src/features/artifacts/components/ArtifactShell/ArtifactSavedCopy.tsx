import { ExternalLink, FolderOpen } from 'lucide-react';
import { Button, SectionHeader } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ArtifactSavedCopy as SavedCopy } from '../../hooks/useArtifactSavedCopy';

type Props = {
  readonly savedCopy: SavedCopy;
};

export const ArtifactSavedCopy = ({ savedCopy }: Props) => {
  const { location, error, reveal, openInBrowser } = savedCopy;
  const saved = location !== null && location.exists ? location : null;
  return (
    <section aria-label="File" className="flex min-w-0 flex-col gap-2">
      <SectionHeader label="File" />
      <div className="flex min-w-0 items-center gap-2">
        <span
          data-testid="artifact-saved-copy-path"
          title={location?.path}
          className="min-w-0 flex-1 truncate font-mono text-meta text-muted-foreground"
        >
          {saved !== null ? saved.path : 'Writing the file…'}
        </span>
        {saved !== null ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={openInBrowser}
            data-testid="artifact-saved-copy-open"
          >
            <ExternalLink size={ICON_SIZE.row} aria-hidden />
            Open in browser
          </Button>
        ) : null}
        {saved !== null ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={reveal}
            data-testid="artifact-saved-copy-reveal"
          >
            <FolderOpen size={ICON_SIZE.row} aria-hidden />
            Show in Finder
          </Button>
        ) : null}
      </div>
      {error === null ? null : (
        <span role="alert" className="text-meta text-danger">
          {error}
        </span>
      )}
    </section>
  );
};

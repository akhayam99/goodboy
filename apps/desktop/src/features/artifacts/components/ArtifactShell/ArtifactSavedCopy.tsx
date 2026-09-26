import { FolderOpen } from 'lucide-react';
import { Button, SectionHeader } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ArtifactSavedCopy as SavedCopy } from '../../hooks/useArtifactSavedCopy';

type Props = {
  readonly savedCopy: SavedCopy;
};

export const ArtifactSavedCopy = ({ savedCopy }: Props) => {
  const { location, error, reveal } = savedCopy;
  const saved = location !== null && location.exists ? location : null;
  return (
    <section aria-label="Saved copy" className="flex min-w-0 flex-col gap-1.5">
      <SectionHeader label="Saved copy" />
      <div className="flex min-w-0 items-center gap-2">
        <span
          data-testid="artifact-saved-copy-path"
          title={location?.path}
          className="min-w-0 flex-1 truncate font-mono text-secondary text-muted-foreground"
        >
          {saved !== null ? saved.path : 'Not on disk yet'}
        </span>
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
        <span role="alert" className="text-secondary text-danger">
          {error}
        </span>
      )}
    </section>
  );
};

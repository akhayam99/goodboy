import { Chip, SelectableRow, Skeleton } from '@goodboy/ui';
import type { ReleaseNote } from '../../changelog';
import { formatReleaseDate } from '../../formatReleaseDate';
import { isInstalledRelease } from '../../isInstalledRelease';

type Props = {
  readonly releases: ReadonlyArray<ReleaseNote>;
  readonly selectedVersion: string | null;
  readonly installedVersion: string | null;
  readonly isLoading: boolean;
  readonly onSelect: (version: string) => void;
};

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

export const ChangelogRail = ({
  releases,
  selectedVersion,
  installedVersion,
  isLoading,
  onSelect,
}: Props) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 p-3" role="status" aria-label="Loading releases">
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 p-3" aria-label="Releases">
      {releases.map((release) => {
        const isActive = release.version === selectedVersion;
        const isInstalled = isInstalledRelease({
          tag: release.version,
          installed: installedVersion,
        });
        return (
          <SelectableRow
            key={release.version}
            selected={isActive}
            ariaCurrent={isActive}
            onClick={() => onSelect(release.version)}
            className="items-center gap-2 px-2.5 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{release.version}</span>
            {isInstalled && <Chip tone="neutral" width="sm" label="installed" />}
            <span className="w-14 shrink-0 text-right text-2xs tabular-nums text-muted-foreground">
              {formatReleaseDate({ iso: release.publishedAt, style: 'short' })}
            </span>
          </SelectableRow>
        );
      })}
    </nav>
  );
};

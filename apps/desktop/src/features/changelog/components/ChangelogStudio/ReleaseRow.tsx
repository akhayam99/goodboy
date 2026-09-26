import { Database } from 'lucide-react';
import { Chip, SelectableRow } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatReleaseDate } from '../../formatReleaseDate';
import { isInstalledRelease } from '../../isInstalledRelease';
import { isNewerRelease } from '../../isNewerRelease';
import type { ReleaseEntry } from '../../parseChangelog';
import { releaseSummary } from '../../releaseSummary';

const dateLabelFor = ({
  dates,
  version,
}: {
  readonly dates: Readonly<Record<string, string>>;
  readonly version: string;
}): string | null => {
  const iso = dates[version];
  if (iso === undefined) {
    return null;
  }
  return formatReleaseDate({ iso, style: 'short' });
};

type Props = {
  readonly release: ReleaseEntry;
  readonly isActive: boolean;
  readonly dates: Readonly<Record<string, string>>;
  readonly installedVersion: string | null;
  readonly onSelect: (version: string) => void;
};

export const ReleaseRow = ({ release, isActive, dates, installedVersion, onSelect }: Props) => {
  const isInstalled = isInstalledRelease({ tag: release.version, installed: installedVersion });
  const isAvailable = isNewerRelease({ tag: release.version, installed: installedVersion });
  const date = dateLabelFor({ dates, version: release.version });
  return (
    <SelectableRow
      selected={isActive}
      ariaCurrent={isActive}
      onClick={() => onSelect(release.version)}
      className="flex-col items-stretch gap-0.5 px-2.5 py-2"
    >
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm">{release.version}</span>
        {release.shape === 'v2' && release.oneWayFrom !== null ? (
          <Chip
            tone="warning"
            size="sm"
            icon={<Database size={ICON_SIZE.row} aria-hidden />}
            label="data"
          />
        ) : null}
        {isInstalled ? <Chip tone="neutral" width="sm" label="installed" /> : null}
        {isAvailable ? <Chip tone="primary" width="sm" label="available" /> : null}
        {date !== null ? (
          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{date}</span>
        ) : null}
      </div>
      <span className="truncate text-2xs text-muted-foreground">{releaseSummary({ release })}</span>
    </SelectableRow>
  );
};

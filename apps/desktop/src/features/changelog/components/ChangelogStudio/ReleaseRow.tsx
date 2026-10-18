import { DoorClosedLocked, Milestone, type LucideIcon } from 'lucide-react';
import { SelectableRow, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { isInstalledRelease } from '../../isInstalledRelease';
import { isNewerRelease } from '../../isNewerRelease';
import { releaseKindOf } from '../../releaseKind';
import type { ReleaseEntry } from '../../parseChangelog';
import { releaseSummary } from '../../releaseSummary';

type OneWayMark = {
  readonly icon: LucideIcon;
  readonly label: string;
};

const ONE_WAY_MARK = {
  minor: {
    icon: DoorClosedLocked,
    label:
      "This release changes your data. You can't go back to an older version after installing it.",
  },
  major: {
    icon: Milestone,
    label:
      "This is a major release. It can remove or replace older ways of working, and you can't go back after installing it.",
  },
} as const satisfies Record<'minor' | 'major', OneWayMark>;

const oneWayMarkFor = ({ release }: { readonly release: ReleaseEntry }): OneWayMark | null => {
  if (release.shape !== 'v2' || release.oneWayFrom === null) {
    return null;
  }
  const kind = releaseKindOf({ version: release.version });
  if (kind === 'patch') {
    return null;
  }
  return ONE_WAY_MARK[kind];
};

type Props = {
  readonly release: ReleaseEntry;
  readonly dateLabel: string | null;
  readonly isActive: boolean;
  readonly installedVersion: string | null;
  readonly onSelect: (version: string) => void;
};

export const ReleaseRow = ({ release, dateLabel, isActive, installedVersion, onSelect }: Props) => {
  const isInstalled = isInstalledRelease({ tag: release.version, installed: installedVersion });
  const isAvailable = isNewerRelease({ tag: release.version, installed: installedVersion });
  const oneWayMark = oneWayMarkFor({ release });
  const meta = [dateLabel, isInstalled ? 'Installed' : null, isAvailable ? 'In the update' : null]
    .filter((part): part is string => part !== null)
    .join(' · ');
  return (
    <SelectableRow
      selected={isActive}
      ariaCurrent={isActive}
      onClick={() => onSelect(release.version)}
      className="flex-col items-stretch gap-0.5 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-body">{release.version}</span>
        <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">{meta}</span>
        {oneWayMark !== null ? (
          <Tooltip content={oneWayMark.label}>
            <span
              role="img"
              aria-label={oneWayMark.label}
              className="shrink-0 text-faint-foreground"
            >
              <oneWayMark.icon size={ICON_SIZE.row} aria-hidden />
            </span>
          </Tooltip>
        ) : null}
      </div>
      <span className="truncate text-meta text-muted-foreground">
        {releaseSummary({ release })}
      </span>
    </SelectableRow>
  );
};

import { DoorClosedLocked, Milestone, type LucideIcon } from 'lucide-react';
import { Chip, SelectableRow } from '@goodboy/ui';
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
  readonly isActive: boolean;
  readonly installedVersion: string | null;
  readonly onSelect: (version: string) => void;
};

export const ReleaseRow = ({ release, isActive, installedVersion, onSelect }: Props) => {
  const isInstalled = isInstalledRelease({ tag: release.version, installed: installedVersion });
  const isAvailable = isNewerRelease({ tag: release.version, installed: installedVersion });
  const oneWayMark = oneWayMarkFor({ release });
  return (
    <SelectableRow
      selected={isActive}
      ariaCurrent={isActive}
      onClick={() => onSelect(release.version)}
      className="flex-col items-stretch gap-0.5 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-body">{release.version}</span>
        {oneWayMark !== null ? (
          <Chip
            tone="warning"
            size="sm"
            icon={<oneWayMark.icon size={ICON_SIZE.row} aria-hidden />}
            ariaLabel={oneWayMark.label}
            title={oneWayMark.label}
          />
        ) : null}
        {isInstalled ? <Chip tone="neutral" width="sm" label="installed" /> : null}
        {isAvailable ? <Chip tone="primary" width="sm" label="in the update" /> : null}
      </div>
      <span className="truncate text-meta text-muted-foreground">
        {releaseSummary({ release })}
      </span>
    </SelectableRow>
  );
};

import { useState } from 'react';
import { ChevronRight, History } from 'lucide-react';
import { Eyebrow, ICON_SIZE, SelectableRow } from '@goodboy/ui';

import type { ChangelogCatchUp } from '../../changelogCatchUp';
import type { ReleaseEntry } from '../../parseChangelog';
import { releaseDateLabel } from '../../releaseDateLabel';
import { ReleaseRow } from './ReleaseRow';

const OLDEST_GROUPED_MINOR = 4;

type VersionParams = {
  readonly version: string;
};

const minorOf = ({ version }: VersionParams): number => {
  const parts = version.split('.');
  const major = Number.parseInt(parts[0] ?? '0', 10);
  const minor = Number.parseInt(parts[1] ?? '0', 10);
  const safeMajor = Number.isNaN(major) ? 0 : major;
  const safeMinor = Number.isNaN(minor) ? 0 : minor;
  return safeMajor * 1000 + safeMinor;
};

const minorLabelOf = ({ version }: VersionParams): string => {
  const parts = version.split('.');
  return `${parts[0] ?? '0'}.${parts[1] ?? '0'}`;
};

type ReleaseGroup = {
  readonly label: string;
  readonly releases: ReadonlyArray<ReleaseEntry>;
  readonly isOlder: boolean;
};

type MutableReleaseGroup = {
  readonly label: string;
  readonly releases: ReleaseEntry[];
  readonly isOlder: boolean;
};

type GroupParams = {
  readonly releases: ReadonlyArray<ReleaseEntry>;
};

const groupReleases = ({ releases }: GroupParams): ReadonlyArray<ReleaseGroup> => {
  const groups: MutableReleaseGroup[] = [];
  releases.forEach((release) => {
    if (minorOf({ version: release.version }) < OLDEST_GROUPED_MINOR) {
      const older = groups.find((group) => group.isOlder);
      if (older === undefined) {
        groups.push({ label: 'Older', releases: [release], isOlder: true });
        return;
      }
      older.releases.push(release);
      return;
    }
    const label = minorLabelOf({ version: release.version });
    const last = groups[groups.length - 1];
    if (last !== undefined && last.label === label && !last.isOlder) {
      last.releases.push(release);
      return;
    }
    groups.push({ label, releases: [release], isOlder: false });
  });
  return groups;
};

type Props = {
  readonly releases: ReadonlyArray<ReleaseEntry>;
  readonly selectedVersion: string | null;
  readonly installedVersion: string | null;
  readonly dates: Readonly<Record<string, string>>;
  readonly catchUp: ChangelogCatchUp | null;
  readonly isCatchUpSelected: boolean;
  readonly onSelect: (version: string) => void;
  readonly onSelectCatchUp: () => void;
};

export const ReleaseList = ({
  releases,
  selectedVersion,
  installedVersion,
  dates,
  catchUp,
  isCatchUpSelected,
  onSelect,
  onSelectCatchUp,
}: Props) => {
  const [isOlderOpen, setIsOlderOpen] = useState(false);
  const groups = groupReleases({ releases });

  return (
    <>
      {catchUp !== null ? (
        <SelectableRow
          selected={isCatchUpSelected}
          ariaCurrent={isCatchUpSelected}
          onClick={onSelectCatchUp}
          className="items-center gap-2 px-3 py-2"
        >
          <History size={ICON_SIZE.row} aria-hidden className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-body text-foreground">
            Since {catchUp.fromVersion} · {catchUp.releases.length} releases
          </span>
        </SelectableRow>
      ) : null}
      {groups.map((group) => {
        if (group.isOlder) {
          return (
            <div key="older" className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setIsOlderOpen((isOpen) => !isOpen)}
                aria-expanded={isOlderOpen}
                className="flex items-center gap-1 px-2 py-1 text-eyebrow text-faint-foreground hover:text-muted-foreground"
              >
                <ChevronRight
                  size={ICON_SIZE.row}
                  aria-hidden
                  className={isOlderOpen ? 'rotate-90' : undefined}
                />
                {group.label} · {group.releases.length} releases
              </button>
              {isOlderOpen
                ? group.releases.map((release) => (
                    <ReleaseRow
                      key={release.version}
                      release={release}
                      dateLabel={releaseDateLabel({ publishedAt: dates[release.version] })}
                      isActive={release.version === selectedVersion}
                      installedVersion={installedVersion}
                      onSelect={onSelect}
                    />
                  ))
                : null}
            </div>
          );
        }
        return (
          <div key={group.label} className="flex flex-col gap-0.5">
            <Eyebrow label={group.label} className="px-2 py-1" />
            {group.releases.map((release) => (
              <ReleaseRow
                key={release.version}
                release={release}
                dateLabel={releaseDateLabel({ publishedAt: dates[release.version] })}
                isActive={release.version === selectedVersion}
                installedVersion={installedVersion}
                onSelect={onSelect}
              />
            ))}
          </div>
        );
      })}
    </>
  );
};

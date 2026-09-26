import { useState } from 'react';
import { ChevronRight, History, Search } from 'lucide-react';
import { Eyebrow, SelectableRow } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ChangelogCatchUp } from '../../changelogCatchUp';
import type { ReleaseEntry } from '../../parseChangelog';
import { ReleaseRow } from './ReleaseRow';

const OLDEST_GROUPED_MINOR = 4;

const minorOf = ({ version }: { readonly version: string }): number => {
  const parts = version.split('.');
  const major = Number.parseInt(parts[0] ?? '0', 10);
  const minor = Number.parseInt(parts[1] ?? '0', 10);
  const safeMajor = Number.isNaN(major) ? 0 : major;
  const safeMinor = Number.isNaN(minor) ? 0 : minor;
  return safeMajor * 1000 + safeMinor;
};

const minorLabelOf = ({ version }: { readonly version: string }): string => {
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

const groupReleases = ({
  releases,
}: {
  readonly releases: ReadonlyArray<ReleaseEntry>;
}): ReadonlyArray<ReleaseGroup> => {
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
  readonly dates: Readonly<Record<string, string>>;
  readonly selectedVersion: string | null;
  readonly installedVersion: string | null;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly catchUp: ChangelogCatchUp | null;
  readonly isCatchUpSelected: boolean;
  readonly onSelect: (version: string) => void;
  readonly onSelectCatchUp: () => void;
};

export const ChangelogRail = ({
  releases,
  dates,
  selectedVersion,
  installedVersion,
  query,
  onQueryChange,
  catchUp,
  isCatchUpSelected,
  onSelect,
  onSelectCatchUp,
}: Props) => {
  const [isOlderOpen, setIsOlderOpen] = useState(false);
  const groups = groupReleases({ releases });
  const isSearching = query.trim() !== '';

  return (
    <nav className="flex flex-col gap-2 p-3" aria-label="Releases">
      <div className="flex h-7 items-center gap-1.5 rounded-md border border-border-soft bg-background px-2 focus-within:border-primary">
        <Search size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search releases"
          aria-label="Search releases"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-faint-foreground"
        />
      </div>
      {catchUp !== null && !isSearching ? (
        <SelectableRow
          selected={isCatchUpSelected}
          ariaCurrent={isCatchUpSelected}
          onClick={onSelectCatchUp}
          className="items-center gap-1.5 px-2.5 py-2"
        >
          <History size={ICON_SIZE.row} aria-hidden className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            Since {catchUp.fromVersion} · {catchUp.releases.length} releases
          </span>
        </SelectableRow>
      ) : null}
      {releases.length === 0 ? (
        <p className="px-1.5 py-2 text-xs text-faint-foreground">No release mentions "{query}".</p>
      ) : null}
      {groups.map((group) => {
        if (group.isOlder && !isSearching) {
          return (
            <div key="older" className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setIsOlderOpen((open) => !open)}
                aria-expanded={isOlderOpen}
                className="flex items-center gap-1 px-1.5 py-1 text-2xs font-semibold uppercase tracking-eyebrow text-faint-foreground hover:text-muted-foreground"
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
                      isActive={release.version === selectedVersion}
                      dates={dates}
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
            <Eyebrow label={group.label} className="px-1.5 py-1" />
            {group.releases.map((release) => (
              <ReleaseRow
                key={release.version}
                release={release}
                isActive={release.version === selectedVersion}
                dates={dates}
                installedVersion={installedVersion}
                onSelect={onSelect}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
};

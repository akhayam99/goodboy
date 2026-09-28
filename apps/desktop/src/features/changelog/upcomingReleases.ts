import { isInstalledRelease } from './isInstalledRelease';
import { isNewerRelease } from './isNewerRelease';
import { parseChangelog } from './parseChangelog';
import type { ReleaseEntry } from './parseChangelog';

type ReleasesInUpdateParams = {
  readonly text: string;
  readonly installed: string;
  readonly target: string;
};

export const releasesInUpdate = ({
  text,
  installed,
  target,
}: ReleasesInUpdateParams): ReadonlyArray<ReleaseEntry> =>
  parseChangelog({ text }).filter(
    (release) =>
      isNewerRelease({ tag: release.version, installed }) &&
      !isNewerRelease({ tag: release.version, installed: target }),
  );

type UpcomingEntriesParams = {
  readonly fetched: ReadonlyArray<ReleaseEntry>;
  readonly notes: ReleaseEntry | null;
  readonly target: string | null;
  readonly installed: string | null;
};

export const upcomingEntries = ({
  fetched,
  notes,
  target,
  installed,
}: UpcomingEntriesParams): ReadonlyArray<ReleaseEntry> => {
  if (target === null || installed === null) {
    return [];
  }
  if (!isNewerRelease({ tag: target, installed })) {
    return [];
  }
  if (fetched.length > 0) {
    return fetched;
  }
  if (notes === null || !isInstalledRelease({ tag: notes.version, installed: target })) {
    return [];
  }
  return [notes];
};

type WithUpcomingParams = {
  readonly upcoming: ReadonlyArray<ReleaseEntry>;
  readonly releases: ReadonlyArray<ReleaseEntry>;
};

export const withUpcomingReleases = ({
  upcoming,
  releases,
}: WithUpcomingParams): ReadonlyArray<ReleaseEntry> => {
  if (upcoming.length === 0) {
    return releases;
  }
  const upcomingVersions = new Set(upcoming.map((release) => release.version));
  return [...upcoming, ...releases.filter((release) => !upcomingVersions.has(release.version))];
};

import { isInstalledRelease } from './isInstalledRelease';
import { isNewerRelease } from './isNewerRelease';
import type { ReleaseEntry } from './parseChangelog';

export type ChangelogCatchUp = {
  readonly fromVersion: string;
  readonly releases: ReadonlyArray<ReleaseEntry>;
};

export type ChangelogCatchUpParams = {
  readonly releases: ReadonlyArray<ReleaseEntry>;
  readonly seenVersion: string | null;
  readonly installedVersion: string | null;
};

export const changelogCatchUp = ({
  releases,
  seenVersion,
  installedVersion,
}: ChangelogCatchUpParams): ChangelogCatchUp | null => {
  if (seenVersion === null || installedVersion === null) {
    return null;
  }
  if (isInstalledRelease({ tag: seenVersion, installed: installedVersion })) {
    return null;
  }
  const between = releases.filter(
    (release) =>
      isNewerRelease({ tag: release.version, installed: seenVersion }) &&
      !isNewerRelease({ tag: release.version, installed: installedVersion }),
  );
  if (between.length <= 1) {
    return null;
  }
  return { fromVersion: seenVersion.trim().replace(/^v/i, ''), releases: between };
};

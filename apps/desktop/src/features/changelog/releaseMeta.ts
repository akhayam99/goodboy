import { isInstalledRelease } from './isInstalledRelease';
import { isNewerRelease } from './isNewerRelease';
import type { ReleaseEntry } from './parseChangelog';

type Params = {
  readonly release: ReleaseEntry;
  readonly dateLabel: string | null;
  readonly installedVersion: string | null;
};

type CountParams = {
  readonly count: number;
  readonly noun: string;
};

const countPart = ({ count, noun }: CountParams): string | null =>
  count > 0 ? `${count} ${noun}` : null;

export const releaseMeta = ({ release, dateLabel, installedVersion }: Params): string => {
  const counts =
    release.shape === 'v2'
      ? [
          countPart({ count: release.sections.new.length, noun: 'new' }),
          countPart({ count: release.sections.improved.length, noun: 'improved' }),
          countPart({ count: release.sections.fixed.length, noun: 'fixed' }),
        ]
      : [];
  const isInstalled = isInstalledRelease({ tag: release.version, installed: installedVersion });
  const isInTheUpdate = isNewerRelease({ tag: release.version, installed: installedVersion });
  const hasOneWay = release.shape === 'v2' && release.oneWayFrom !== null;
  return [
    dateLabel,
    ...counts,
    isInstalled ? 'Installed' : null,
    isInTheUpdate ? 'In the update' : null,
    hasOneWay ? 'Changes your data' : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
};

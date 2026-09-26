import { isChangelogArea } from './changelogAreas';
import type { ChangelogArea } from './changelogAreas';
import type { ReleaseEntry } from './parseChangelog';

const AREA_QUERY_PATTERN = /^area:(\S+)$/i;

const releaseText = ({ release }: { readonly release: ReleaseEntry }): string => {
  if (release.shape === 'markdown') {
    return `${release.version} ${release.markdown ?? ''}`;
  }
  const featureText = [...release.sections.new, ...release.sections.improved]
    .map((feature) => `${feature.title} ${feature.paragraphs.join(' ')} ${feature.area}`)
    .join(' ');
  const fixText = release.sections.fixed.map((fix) => `${fix.text} ${fix.area}`).join(' ');
  return `${release.version} ${release.lead ?? ''} ${featureText} ${fixText}`;
};

type MatchesAreaParams = {
  readonly release: ReleaseEntry;
  readonly area: ChangelogArea;
};

const matchesArea = ({ release, area }: MatchesAreaParams): boolean => {
  if (release.shape === 'markdown') {
    return false;
  }
  const areas: ReadonlyArray<ChangelogArea> = [
    ...release.sections.new.map((feature) => feature.area),
    ...release.sections.improved.map((feature) => feature.area),
    ...release.sections.fixed.map((fix) => fix.area),
  ];
  return areas.includes(area);
};

export type SearchReleasesParams = {
  readonly releases: ReadonlyArray<ReleaseEntry>;
  readonly query: string;
};

export const searchReleases = ({
  releases,
  query,
}: SearchReleasesParams): ReadonlyArray<ReleaseEntry> => {
  const trimmed = query.trim();
  if (trimmed === '') {
    return releases;
  }
  const areaMatch = AREA_QUERY_PATTERN.exec(trimmed);
  if (areaMatch !== null) {
    const value = areaMatch[1];
    if (value !== undefined && isChangelogArea(value)) {
      return releases.filter((release) => matchesArea({ release, area: value }));
    }
    return [];
  }
  const needle = trimmed.toLowerCase();
  return releases.filter((release) => releaseText({ release }).toLowerCase().includes(needle));
};

import { NAMES } from '../../../shared/utils/names';
import { searchReleases } from '../../../features/changelog/searchReleases';
import type { ReleaseEntry } from '../../../features/changelog/parseChangelog';
import type { GuideChapter } from '../../../features/settings/components/GuideStudio/guideChapters';
import {
  searchChapters,
  type GuideHit,
} from '../../../features/settings/components/GuideStudio/searchChapters';
import type { HelpTab } from './helpTabs';
import { rankGuideHits } from './rankGuideHits';
import { searchShortcuts } from './searchShortcuts';

export type HelpHit =
  | { readonly kind: 'guide'; readonly key: string; readonly hit: GuideHit }
  | { readonly kind: 'release'; readonly key: string; readonly version: string }
  | {
      readonly kind: 'shortcut';
      readonly key: string;
      readonly label: string;
      readonly glyphs: string;
    };

export const HELP_HIT_TAB: Readonly<Record<HelpHit['kind'], HelpTab>> = {
  guide: 'guide',
  release: 'whatsNew',
  shortcut: 'shortcuts',
};

export const HELP_HIT_GROUP: Readonly<Record<HelpHit['kind'], string>> = {
  guide: 'Guide',
  release: NAMES.whatsNew,
  shortcut: 'Shortcuts',
};

type Params = {
  readonly chapters: ReadonlyArray<GuideChapter>;
  readonly releases: ReadonlyArray<ReleaseEntry>;
  readonly query: string;
};

export const searchHelp = ({ chapters, releases, query }: Params): ReadonlyArray<HelpHit> => {
  if (query.trim() === '') {
    return [];
  }
  return [
    ...rankGuideHits({ hits: searchChapters({ chapters, query }), query }).map((hit): HelpHit => ({
      kind: 'guide',
      key: `guide:${hit.key}`,
      hit,
    })),
    ...searchReleases({ releases, query }).map((release): HelpHit => ({
      kind: 'release',
      key: `release:${release.version}`,
      version: release.version,
    })),
    ...searchShortcuts({ query }).map((shortcut): HelpHit => ({
      kind: 'shortcut',
      key: `shortcut:${shortcut.key}`,
      label: shortcut.label,
      glyphs: shortcut.glyphs,
    })),
  ];
};

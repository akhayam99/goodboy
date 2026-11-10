import { useEffect, useMemo, useState } from 'react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import type { RailSearchStep } from '../../../shared/components/RailSearch';
import { StudioShell } from '../../../shared/components/StudioShell';
import { NAMES } from '../../../shared/utils/names';
import { useAppStore } from '../../../store';
import type { ChangelogScreen } from '../../../features/changelog/changelogScreens';
import {
  WhatsNewTab,
  type ReleaseRequest,
} from '../../../features/changelog/components/ChangelogStudio/WhatsNewTab';
import { GUIDE_CHAPTERS } from '../../../features/settings/components/GuideStudio/guideChapters';
import { onGuideChapterRequest } from '../../../features/settings/components/GuideStudio/guideChapterRequest';
import {
  GuideTab,
  type GuideFocus,
} from '../../../features/settings/components/GuideStudio/GuideTab';
import { HelpRailHeader } from './HelpRailHeader';
import { HelpResults } from './HelpResults';
import { SponsorLink } from './SponsorLink';
import { capReleaseHits } from './capReleaseHits';
import { HELP_HIT_TAB, searchHelp, type HelpHit } from './searchHelp';
import type { HelpTab } from './helpTabs';

type OpenScreenParams = {
  readonly screen: ChangelogScreen;
};

type Props = {
  readonly tab: HelpTab;
  readonly onClose: () => void;
  readonly onOpenScreen: (params: OpenScreenParams) => void;
};

type ChangeQueryParams = {
  readonly next: string;
};

type ChangeTabParams = {
  readonly next: HelpTab;
};

type StepParams = {
  readonly direction: RailSearchStep;
};

type OpenHitParams = {
  readonly hit: HelpHit;
};

const TAB_TITLE: Readonly<Record<HelpTab, string>> = {
  guide: NAMES.guide,
  whatsNew: NAMES.whatsNew,
};

export const HelpStudio = ({ tab, onClose, onOpenScreen }: Props) => {
  const releases = useAppStore((state) => state.changelogReleases);
  const switchStudio = useAppStore((state) => state.switchStudio);
  const [query, setQuery] = useState('');
  const [activeHit, setActiveHit] = useState(0);
  const [guideFocus, setGuideFocus] = useState<GuideFocus | null>(null);
  const [releaseRequest, setReleaseRequest] = useState<ReleaseRequest | null>(null);
  const [isAllReleasesShown, setIsAllReleasesShown] = useState(false);
  const found = useMemo(
    () => searchHelp({ chapters: GUIDE_CHAPTERS, releases, query }),
    [releases, query],
  );
  const { shown: hits, hiddenCount } = capReleaseHits({
    hits: found,
    isAllShown: isAllReleasesShown,
  });
  const isSearching = query.trim() !== '';

  const changeTab = ({ next }: ChangeTabParams) => {
    if (next === tab) {
      return;
    }
    switchStudio({ studio: { kind: next === 'guide' ? 'guide' : 'changelog' } });
  };

  useEffect(
    () =>
      onGuideChapterRequest({
        listener: () => {
          switchStudio({ studio: { kind: 'guide' } });
          setQuery('');
        },
      }),
    [switchStudio],
  );

  const changeQuery = ({ next }: ChangeQueryParams) => {
    setQuery(next);
    setActiveHit(0);
    setIsAllReleasesShown(false);
  };

  const step = ({ direction }: StepParams) => {
    if (hits.length === 0) {
      return;
    }
    const delta = direction === 'next' ? 1 : -1;
    setActiveHit((current) => (current + delta + hits.length) % hits.length);
  };

  const openHit = ({ hit }: OpenHitParams) => {
    const nonce = Date.now();
    if (hit.kind === 'guide') {
      setGuideFocus({ chapterId: hit.hit.chapterId, term: hit.hit.term, nonce });
    }
    if (hit.kind === 'release') {
      setReleaseRequest({ version: hit.version, nonce });
    }
    changeTab({ next: HELP_HIT_TAB[hit.kind] });
    changeQuery({ next: '' });
  };

  const submit = () => {
    const hit = hits[Math.min(activeHit, hits.length - 1)];
    if (hit !== undefined) {
      openHit({ hit });
    }
  };

  const header = (
    <HelpRailHeader
      tab={tab}
      query={query}
      onTabChange={(next) => changeTab({ next })}
      onQueryChange={(next) => changeQuery({ next })}
      onSubmit={submit}
      onStep={(direction) => step({ direction })}
    />
  );
  const results = isSearching ? (
    <HelpResults
      query={query}
      hits={hits}
      hiddenReleaseCount={hiddenCount}
      activeHit={activeHit}
      onOpenHit={(hit) => openHit({ hit })}
      onShowAllReleases={() => setIsAllReleasesShown(true)}
    />
  ) : null;

  return (
    <StudioShell
      icon={tab === 'guide' ? CONCEPT_ICONS.guide : CONCEPT_ICONS.changelog}
      tone={tab === 'guide' ? CONCEPT_TONE.guide : CONCEPT_TONE.changelog}
      title={TAB_TITLE[tab]}
      headerAccessory={<SponsorLink />}
      onClose={onClose}
    >
      {() => {
        if (tab === 'whatsNew') {
          return (
            <WhatsNewTab
              header={header}
              results={results}
              request={releaseRequest}
              onOpenScreen={onOpenScreen}
            />
          );
        }
        return <GuideTab header={header} results={results} focus={guideFocus} />;
      }}
    </StudioShell>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import type { RailSearchStep } from '../../../shared/components/RailSearch';
import { StudioShell } from '../../../shared/components/StudioShell';
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
import { HELP_HIT_TAB, searchHelp, type HelpHit } from './searchHelp';
import type { HelpTab } from './helpTabs';
import { ShortcutsTab } from './ShortcutsTab';

type OpenScreenParams = {
  readonly screen: ChangelogScreen;
};

type Props = {
  readonly initialTab: HelpTab;
  readonly onClose: () => void;
  readonly onOpenScreen: (params: OpenScreenParams) => void;
};

type ChangeQueryParams = {
  readonly next: string;
};

type StepParams = {
  readonly direction: RailSearchStep;
};

type OpenHitParams = {
  readonly hit: HelpHit;
};

export const HelpStudio = ({ initialTab, onClose, onOpenScreen }: Props) => {
  const releases = useAppStore((state) => state.changelogReleases);
  const [tab, setTab] = useState<HelpTab>(initialTab);
  const [query, setQuery] = useState('');
  const [activeHit, setActiveHit] = useState(0);
  const [guideFocus, setGuideFocus] = useState<GuideFocus | null>(null);
  const [releaseRequest, setReleaseRequest] = useState<ReleaseRequest | null>(null);
  const hits = useMemo(
    () => searchHelp({ chapters: GUIDE_CHAPTERS, releases, query }),
    [releases, query],
  );
  const isSearching = query.trim() !== '';

  useEffect(
    () =>
      onGuideChapterRequest({
        listener: () => {
          setTab('guide');
          setQuery('');
        },
      }),
    [],
  );

  const changeQuery = ({ next }: ChangeQueryParams) => {
    setQuery(next);
    setActiveHit(0);
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
    setTab(HELP_HIT_TAB[hit.kind]);
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
      onTabChange={setTab}
      onQueryChange={(next) => changeQuery({ next })}
      onSubmit={submit}
      onStep={(direction) => step({ direction })}
    />
  );
  const results = isSearching ? (
    <HelpResults
      query={query}
      hits={hits}
      activeHit={activeHit}
      onOpenHit={(hit) => openHit({ hit })}
    />
  ) : null;

  return (
    <StudioShell
      icon={CONCEPT_ICONS.guide}
      tone={CONCEPT_TONE.guide}
      title="Help"
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
        if (tab === 'shortcuts') {
          return <ShortcutsTab header={header} results={results} />;
        }
        return <GuideTab header={header} results={results} focus={guideFocus} />;
      }}
    </StudioShell>
  );
};

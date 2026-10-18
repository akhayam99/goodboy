import { useEffect, useState } from 'react';
import { StudioRailLayout, useStudioRailFold } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { RailSearchStep } from '../../../../shared/components/RailSearch';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { StudioDetail } from '../../../../shared/components/StudioShell/StudioDetail';
import { GUIDE_CHAPTERS } from './guideChapters';
import { clearGuideChapter, onGuideChapterRequest, peekGuideChapter } from './guideChapterRequest';
import { ChapterPage, type GuideFlash } from './parts/ChapterPage';
import { GuideRail } from './parts/GuideRail';
import { resolveGuideChapter } from './resolveGuideChapter';
import { searchChapters, type GuideHit } from './searchChapters';
import { useOpenGuideTarget } from './useOpenGuideTarget';

type Props = {
  readonly onClose: () => void;
};

type OpenParams = {
  readonly id: string;
  readonly term: string | null;
};

export const GuideStudio = ({ onClose }: Props) => {
  const fold = useStudioRailFold({ surface: 'guide' });
  const openTarget = useOpenGuideTarget();
  const [chapterId, setChapterId] = useState(
    () => resolveGuideChapter({ id: peekGuideChapter() }).id,
  );
  const [query, setQuery] = useState('');
  const [activeHit, setActiveHit] = useState(0);
  const [flash, setFlash] = useState<GuideFlash | null>(null);
  const hits = searchChapters({ chapters: GUIDE_CHAPTERS, query });
  const chapter = resolveGuideChapter({ id: chapterId });
  const index = GUIDE_CHAPTERS.indexOf(chapter);
  const previous = GUIDE_CHAPTERS[index - 1] ?? null;
  const next = GUIDE_CHAPTERS[index + 1] ?? null;

  const open = ({ id, term }: OpenParams) => {
    setChapterId(resolveGuideChapter({ id }).id);
    setQuery('');
    setActiveHit(0);
    setFlash(term === null ? null : { term, nonce: Date.now() });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => clearGuideChapter());
    const stopListening = onGuideChapterRequest({
      listener: () => {
        const requested = peekGuideChapter();
        clearGuideChapter();
        if (requested !== null) {
          open({ id: requested, term: null });
        }
      },
    });
    return () => {
      cancelAnimationFrame(frame);
      stopListening();
    };
  }, []);

  const changeQuery = (next: string) => {
    setQuery(next);
    setActiveHit(0);
  };

  const step = (direction: RailSearchStep) => {
    if (hits.length === 0) {
      return;
    }
    const delta = direction === 'next' ? 1 : -1;
    setActiveHit((current) => (current + delta + hits.length) % hits.length);
  };

  const openHit = (hit: GuideHit) => open({ id: hit.chapterId, term: hit.term });

  const submit = () => {
    const hit = hits[Math.min(activeHit, hits.length - 1)];
    if (hit !== undefined) {
      openHit(hit);
    }
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.guide}
      tone={CONCEPT_TONE.guide}
      title="Guide"
      onClose={onClose}
    >
      {() => (
        <StudioRailLayout
          railLabel="Guide chapters"
          railWidth="standard"
          surface="guide"
          placement="page"
          isCollapsed={fold.isCollapsed}
          onCollapsedChange={fold.setFolded}
          rail={
            <GuideRail
              chapterId={chapter.id}
              query={query}
              hits={hits}
              activeHit={activeHit}
              onQueryChange={changeQuery}
              onStep={step}
              onSubmit={submit}
              onOpenChapter={(id) => open({ id, term: null })}
              onOpenHit={openHit}
            />
          }
          detail={
            <StudioDetail>
              <ChapterPage
                key={chapter.id}
                chapter={chapter}
                previous={previous}
                next={next}
                flash={flash}
                onOpen={openTarget}
                onGo={(id) => open({ id, term: null })}
              />
            </StudioDetail>
          }
        />
      )}
    </StudioShell>
  );
};

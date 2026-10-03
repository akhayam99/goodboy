import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollFade, StudioRailLayout } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { GUIDE_CHAPTERS } from './guideChapters';
import { clearGuideChapter, peekGuideChapter } from './guideChapterRequest';
import { GuideContent } from './parts/GuideContent';
import { GuideRail } from './parts/GuideRail';
import { searchChapters } from './searchChapters';
import { useOpenGuideTarget } from './useOpenGuideTarget';

type Props = {
  readonly onClose: () => void;
};

export const GuideStudio = ({ onClose }: Props) => {
  const scrollToRef = useRef<(id: string) => void>(() => {});
  const suppressUntilRef = useRef(0);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const openTarget = useOpenGuideTarget();
  const chapters = searchChapters({ chapters: GUIDE_CHAPTERS, query });
  const shownActiveId =
    chapters.find((chapter) => chapter.id === activeId)?.id ?? chapters[0]?.id ?? null;

  const jump = (id: string) => {
    suppressUntilRef.current = Date.now() + 700;
    setActiveId(id);
    scrollToRef.current(id);
  };

  useEffect(() => {
    const requested = peekGuideChapter();
    if (requested === null) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      clearGuideChapter();
      jump(requested);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const onVisible = useCallback((id: string) => {
    if (Date.now() >= suppressUntilRef.current) {
      setActiveId(id);
    }
  }, []);

  const registerScrollTo = useCallback((fn: (id: string) => void) => {
    scrollToRef.current = fn;
  }, []);

  return (
    <StudioShell
      icon={CONCEPT_ICONS.guide}
      tone={CONCEPT_TONE.guide}
      title="Guide"
      subtitle="How Goodboy works, chapter by chapter"
      closeLabel="close guide"
      onClose={onClose}
    >
      {() => (
        <StudioRailLayout
          railLabel="Guide chapters"
          railWidth="standard"
          surface="guide"
          rail={
            <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
              <GuideRail
                chapters={chapters}
                activeId={shownActiveId}
                query={query}
                onQueryChange={setQuery}
                onSelect={jump}
              />
            </ScrollFade>
          }
          detail={
            <GuideContent
              chapters={chapters}
              onOpen={openTarget}
              onVisible={onVisible}
              registerScrollTo={registerScrollTo}
            />
          }
        />
      )}
    </StudioShell>
  );
};

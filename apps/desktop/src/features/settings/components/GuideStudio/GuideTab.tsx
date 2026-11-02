import { useEffect, useState, type ReactNode } from 'react';
import { StudioRailLayout, useStudioRailFold } from '@goodboy/ui';
import { StudioDetail } from '../../../../shared/components/StudioShell/StudioDetail';
import { GUIDE_CHAPTERS } from './guideChapters';
import { clearGuideChapter, onGuideChapterRequest, peekGuideChapter } from './guideChapterRequest';
import { ChapterPage, type GuideFlash } from './parts/ChapterPage';
import { GuideRail } from './parts/GuideRail';
import { resolveGuideChapter } from './resolveGuideChapter';
import { useOpenGuideTarget } from './useOpenGuideTarget';

export type GuideFocus = {
  readonly chapterId: string;
  readonly term: string | null;
  readonly nonce: number;
};

type Props = {
  readonly header: ReactNode;
  readonly results: ReactNode | null;
  readonly focus: GuideFocus | null;
};

type OpenParams = {
  readonly id: string;
  readonly term: string | null;
};

type FlashParams = {
  readonly focus: GuideFocus | null;
};

const flashOf = ({ focus }: FlashParams): GuideFlash | null =>
  focus === null || focus.term === null ? null : { term: focus.term, nonce: focus.nonce };

export const GuideTab = ({ header, results, focus }: Props) => {
  const fold = useStudioRailFold({ surface: 'guide' });
  const openTarget = useOpenGuideTarget();
  const [chapterId, setChapterId] = useState(
    () => resolveGuideChapter({ id: focus?.chapterId ?? peekGuideChapter() }).id,
  );
  const [flash, setFlash] = useState<GuideFlash | null>(() => flashOf({ focus }));
  const chapter = resolveGuideChapter({ id: chapterId });
  const index = GUIDE_CHAPTERS.indexOf(chapter);
  const previous = GUIDE_CHAPTERS[index - 1] ?? null;
  const next = GUIDE_CHAPTERS[index + 1] ?? null;

  const open = ({ id, term }: OpenParams) => {
    setChapterId(resolveGuideChapter({ id }).id);
    setFlash(term === null ? null : { term, nonce: Date.now() });
  };

  useEffect(() => {
    if (focus === null) {
      return;
    }
    setChapterId(resolveGuideChapter({ id: focus.chapterId }).id);
    setFlash(flashOf({ focus }));
  }, [focus]);

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

  return (
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
          header={header}
          results={results}
          onOpenChapter={(id) => open({ id, term: null })}
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
  );
};

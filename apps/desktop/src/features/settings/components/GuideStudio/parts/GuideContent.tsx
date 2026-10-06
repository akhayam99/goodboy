import { useEffect, useRef } from 'react';
import { PageColumn, ScrollFade } from '@goodboy/ui';
import type { GuideChapter, GuideExtra } from '../guideChapters';
import type { GuideTarget } from '../guideTarget';
import { ChapterSection } from './ChapterSection';
import { findScrollParent } from './findScrollParent';
import { LegendSection } from './LegendSection';
import { ListensExtra } from './ListensExtra';
import { ShortcutsExtra } from './ShortcutsExtra';
import { StagesExtra } from './StagesExtra';

const renderExtra = ({ extra }: { readonly extra: GuideExtra | undefined }) => {
  switch (extra) {
    case 'stages':
      return <StagesExtra />;
    case 'shortcuts':
      return <ShortcutsExtra />;
    case 'listens':
      return <ListensExtra />;
    case 'legend':
      return <LegendSection />;
    case undefined:
      return null;
    default: {
      const unreachable: never = extra;
      return unreachable;
    }
  }
};

type Props = {
  readonly chapters: ReadonlyArray<GuideChapter>;
  readonly onOpen: (target: GuideTarget) => void;
  readonly onVisible: (id: string) => void;
  readonly registerScrollTo: (fn: (id: string) => void) => void;
};

export const GuideContent = ({ chapters, onOpen, onVisible, registerScrollTo }: Props) => {
  const anchorsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;
  const chapterKey = chapters.map((chapter) => chapter.id).join('|');

  useEffect(() => {
    registerScrollTo((id) =>
      anchorsRef.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }, [registerScrollTo]);

  useEffect(() => {
    const els = Object.values(anchorsRef.current).filter((el): el is HTMLDivElement => el != null);
    const first = els[0];
    if (first === undefined) {
      return;
    }
    const root = findScrollParent({ element: first });
    const observer = new IntersectionObserver(
      (records) => {
        const top = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = top?.target.getAttribute('data-guide-section');
        if (id) {
          onVisibleRef.current(id);
        }
      },
      { root, rootMargin: '0px 0px -65% 0px', threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [chapterKey]);

  const anchor = (id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      el.dataset.guideSection = id;
      el.style.scrollMarginTop = '2.5rem';
    }
    anchorsRef.current[id] = el;
  };

  return (
    <ScrollFade className="h-full w-full">
      <PageColumn className="flex flex-col gap-14 pb-24 pt-5">
        {chapters.map((chapter) => (
          <div key={chapter.id} ref={anchor(chapter.id)}>
            <ChapterSection chapter={chapter} onOpen={onOpen}>
              {renderExtra({ extra: chapter.extra })}
            </ChapterSection>
          </div>
        ))}
      </PageColumn>
    </ScrollFade>
  );
};

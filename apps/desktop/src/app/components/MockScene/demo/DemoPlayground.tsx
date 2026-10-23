import { useCallback, useEffect, useRef, useState } from 'react';
import { applyDocumentTheme } from '../../../../shared/lib/theme';
import { DEMO_CHAPTERS, DEMO_GROUPS } from './demoChapters';
import { DemoTopBar } from './DemoTopBar';
import { DemoRail } from './DemoRail';
import { DemoChapterHeader } from './DemoChapterHeader';
import { DemoStage } from './DemoStage';
import { DemoTimeline } from './DemoTimeline';
import { DemoClosing } from './DemoClosing';
import { useBeatPlayer } from './useBeatPlayer';
import { useChapterHash } from './useChapterHash';
import { useDemoKeys } from './useDemoKeys';

type Theme = 'dark' | 'light';

type ChapterParams = {
  readonly id: string;
};

type ShownParams = {
  readonly key: string;
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

const initialTheme = (): Theme =>
  new URLSearchParams(window.location.search).get('theme') === 'light' ? 'light' : 'dark';

export const DemoPlayground = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const { chapterId, selectChapter } = useChapterHash({ chapters: DEMO_CHAPTERS });
  const [visitedIds, setVisitedIds] = useState<ReadonlySet<string>>(() => new Set([chapterId]));

  const chapterIndex = Math.max(
    0,
    DEMO_CHAPTERS.findIndex((entry) => entry.id === chapterId),
  );
  const [shownKey, setShownKey] = useState<string | undefined>(undefined);
  const chapter = DEMO_CHAPTERS[chapterIndex] ?? DEMO_CHAPTERS[0];
  const previousChapter = DEMO_CHAPTERS[chapterIndex - 1];
  const nextChapter = DEMO_CHAPTERS[chapterIndex + 1];
  const [isReducedMotion] = useState(prefersReducedMotion);
  const player = useBeatPlayer({ chapter, nextChapter, theme, shownKey, isReducedMotion });

  const groupChapters = DEMO_CHAPTERS.filter((entry) => entry.group === chapter.group);
  const position = `${DEMO_GROUPS[chapter.group].noun} ${groupChapters.indexOf(chapter) + 1} of ${groupChapters.length}`;

  const focusFrame = useCallback(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    focusFrame();
  }, [focusFrame]);

  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);

  useEffect(() => {
    setVisitedIds((current) =>
      current.has(chapter.id) ? current : new Set([...current, chapter.id]),
    );
  }, [chapter.id]);

  const goToChapter = useCallback(
    ({ id }: ChapterParams) => {
      selectChapter({ id });
      focusFrame();
    },
    [selectChapter, focusFrame],
  );

  const onPrevious = useCallback(() => {
    if (previousChapter === undefined) {
      return;
    }
    goToChapter({ id: previousChapter.id });
  }, [previousChapter, goToChapter]);

  const onNext = useCallback(() => {
    if (nextChapter === undefined) {
      return;
    }
    goToChapter({ id: nextChapter.id });
  }, [nextChapter, goToChapter]);

  const onToggle = player.isPlaying ? player.pause : player.play;
  const onKeyDown = useDemoKeys({ onPrevious, onNext, onToggle, onReplay: player.replay });

  const onShown = useCallback(({ key }: ShownParams) => setShownKey(key), []);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex h-screen min-h-0 flex-col bg-background text-foreground outline-none"
    >
      <DemoTopBar
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      />
      <div className="flex min-h-0 flex-1">
        <DemoRail
          chapters={DEMO_CHAPTERS}
          activeId={chapter.id}
          visitedIds={visitedIds}
          onSelect={goToChapter}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-4 pb-4 pt-2 sm:px-6">
          <DemoChapterHeader chapter={chapter} position={position} />
          <DemoStage
            frame={player.frame}
            preloadFrame={player.preloadFrame}
            command={player.command}
            onShown={onShown}
            onReport={player.report}
            onInteract={player.interact}
            onFocusLost={focusFrame}
          />
          <DemoTimeline
            chapter={chapter}
            player={player}
            nextChapter={nextChapter}
            hasPrevious={previousChapter !== undefined}
            onPrevious={onPrevious}
            onNext={onNext}
            onRestart={() => goToChapter({ id: DEMO_CHAPTERS[0].id })}
          />
          {nextChapter === undefined ? <DemoClosing /> : null}
        </main>
      </div>
    </div>
  );
};

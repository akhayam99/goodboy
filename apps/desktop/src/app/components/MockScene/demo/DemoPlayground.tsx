import { useCallback, useEffect, useRef, useState } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import { DEMO_CHAPTERS } from './demoChapters';
import { DEFAULT_GROUP_ID } from './defaultGroupId';
import { DemoTopBar } from './DemoTopBar';
import { DemoRail } from './DemoRail';
import { DemoChapterHeader } from './DemoChapterHeader';
import { DemoStage, type ShortcutRequest } from './DemoStage';
import { DemoTimeline } from './DemoTimeline';
import { useBeatPlayer } from './useBeatPlayer';
import { useChapterHash } from './useChapterHash';
import { useDemoKeys, type FrameShortcutParams } from './useDemoKeys';
import { useDemoTheme } from './useDemoTheme';
import { isEveryGroupTried } from './hints/isEveryGroupTried';
import { useDemoHints, type DemoHints, type HintReportParams } from './useDemoHints';
import { useGroupVisits } from './useGroupVisits';

type ChapterParams = {
  readonly id: string;
};

type ShownParams = {
  readonly key: string;
};

type AnnouncementParams = {
  readonly coach: DemoHints['coach'];
  readonly offscreen: DemoHints['offscreen'];
  readonly closing: DemoHints['closing'];
};

const hintAnnouncement = ({ coach, offscreen, closing }: AnnouncementParams): string => {
  const copy = coach?.copy ?? offscreen?.copy ?? closing?.copy;
  return copy === undefined ? '' : `Hint: ${copy}`;
};

export const DemoPlayground = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, choose: chooseTheme, toggle: swapTheme } = useDemoTheme();
  const [shortcut, setShortcut] = useState<ShortcutRequest | undefined>(undefined);
  const { chapterId, selectChapter } = useChapterHash({
    chapters: DEMO_CHAPTERS,
    fallbackId: DEFAULT_GROUP_ID,
  });

  const chapterIndex = Math.max(
    0,
    DEMO_CHAPTERS.findIndex((entry) => entry.id === chapterId),
  );
  const [shownKey, setShownKey] = useState<string | undefined>(undefined);
  const chapter = DEMO_CHAPTERS[chapterIndex] ?? DEMO_CHAPTERS[0];
  const previousChapter = DEMO_CHAPTERS[chapterIndex - 1];
  const nextChapter = DEMO_CHAPTERS[chapterIndex + 1];
  const [intentId, setIntentId] = useState<string | undefined>(undefined);
  const intentChapter =
    intentId === undefined || intentId === chapter.id
      ? undefined
      : DEMO_CHAPTERS.find((entry) => entry.id === intentId);
  const player = useBeatPlayer({ chapter, nextChapter, intentChapter, theme, shownKey });

  const hints = useDemoHints({ chapter, chapters: DEMO_CHAPTERS, frameKey: player.frame.key });
  const visitedIds = useGroupVisits({ chapterId: chapter.id });

  const focusFrame = useCallback(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    focusFrame();
  }, [focusFrame]);

  const goToChapter = useCallback(
    ({ id }: ChapterParams) => {
      selectChapter({ id });
      setIntentId(undefined);
      focusFrame();
    },
    [selectChapter, focusFrame],
  );

  const onIntent = useCallback(({ id }: ChapterParams) => setIntentId(id), []);

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

  const { reset: resetHints, onHintReport: onHintNote } = hints;
  const { replay, follow } = player;
  const onReplay = useCallback(() => {
    resetHints();
    replay();
  }, [resetHints, replay]);
  const onHintReport = useCallback(
    ({ key, report }: HintReportParams) => {
      if (report.type === 'place') {
        follow({ key, place: report.place });
        return;
      }
      onHintNote({ key, report });
    },
    [follow, onHintNote],
  );
  const onFrameShortcut = useCallback(({ code }: FrameShortcutParams) => {
    setShortcut((previous) => ({ code, count: (previous?.count ?? 0) + 1 }));
  }, []);
  const onKeyDown = useDemoKeys({
    onPrevious,
    onNext,
    onReplay,
    onShowHint: hints.show,
    onFrameShortcut,
  });
  useEscapeLayer(hints.hide, hints.coach !== undefined || hints.offscreen !== undefined);

  const onShown = useCallback(({ key }: ShownParams) => setShownKey(key), []);
  const isSpotlit = hints.coach?.isSpotlit === true;
  const isLastBeat = player.beatIndex === chapter.beats.length - 1;
  const isGroupDone =
    hints.tally.total > 0
      ? hints.tally.tried >= hints.tally.total
      : isLastBeat && player.isComplete;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex h-screen min-h-0 flex-col bg-surround text-foreground outline-none"
    >
      <DemoTopBar theme={theme} isQuiet={isSpotlit} onToggleTheme={swapTheme} />
      <div className="flex min-h-0 flex-1">
        <DemoRail
          chapters={DEMO_CHAPTERS}
          activeId={chapter.id}
          tallyOf={hints.tallyOf}
          onSelect={goToChapter}
          onIntent={onIntent}
          upNextId={nextChapter?.id}
          isUpNextReady={isGroupDone}
          isQuiet={isSpotlit}
          closing={hints.closing}
          isEveryGroupTried={isEveryGroupTried({
            chapters: DEMO_CHAPTERS,
            tallyOf: hints.tallyOf,
            visitedIds,
          })}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-4 pb-4 pt-2 sm:px-6">
          <DemoChapterHeader
            chapter={chapter}
            tally={hints.tally}
            isHintHidden={hints.isHidden}
            onShowHint={hints.show}
          />
          <DemoStage
            theme={theme}
            onThemeChange={chooseTheme}
            shortcut={shortcut}
            frame={player.frame}
            preloadFrame={player.preloadFrame}
            command={player.command}
            onShown={onShown}
            onReport={player.report}
            onFocusLost={focusFrame}
            hintTrack={hints.track}
            coach={hints.coach}
            offscreen={hints.offscreen}
            reveal={hints.reveal}
            onHintReport={onHintReport}
            onSkipHint={hints.skip}
            onHideHint={hints.hide}
            onRevealHint={hints.revealHint}
          />
          <p className="sr-only" aria-live="polite">
            {hintAnnouncement({
              coach: hints.coach,
              offscreen: hints.offscreen,
              closing: hints.closing,
            })}
          </p>
          <DemoTimeline
            chapter={chapter}
            player={player}
            onReplay={onReplay}
            hasPrevious={previousChapter !== undefined}
            onPrevious={onPrevious}
          />
        </main>
      </div>
    </div>
  );
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import { DEMO_CHAPTERS } from './demoChapters';
import { DEFAULT_GROUP_ID } from './defaultGroupId';
import { DemoTopBar } from './DemoTopBar';
import { DemoRail } from './DemoRail';
import { DemoChapterHeader } from './DemoChapterHeader';
import { DemoStage, type ShortcutRequest } from './DemoStage';
import { DemoCompactNav } from './DemoCompactNav';
import { useBeatPlayer } from './useBeatPlayer';
import { useChapterHash } from './useChapterHash';
import { useDemoKeys, type FrameShortcutParams } from './useDemoKeys';
import { useDemoTheme } from './useDemoTheme';
import { headerInstruction } from './hints/headerInstruction';
import { useDemoHints, type DemoHints, type HintReportParams } from './useDemoHints';
import { useStepVisits } from './useStepVisits';

type ChapterParams = {
  readonly id: string;
};

type ShownParams = {
  readonly key: string;
};

type ToggleHintsParams = {
  readonly isEnabled: boolean;
};

type AnnouncementParams = {
  readonly coach: DemoHints['coach'];
  readonly offscreen: DemoHints['offscreen'];
};

const hintAnnouncement = ({ coach, offscreen }: AnnouncementParams): string => {
  const copy = coach?.copy ?? offscreen?.copy;
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

  const hints = useDemoHints({ chapter, frameKey: player.frame.key });
  const { visits, restart: restartVisits } = useStepVisits({
    chapterId: chapter.id,
    beatIndex: player.beatIndex,
  });

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

  const {
    reset: resetHints,
    restart: restartHints,
    show: showHints,
    hide: hideHints,
    onHintReport: onHintNote,
  } = hints;
  const { replay, follow, goTo } = player;
  const onReplay = useCallback(() => {
    resetHints();
    replay();
  }, [resetHints, replay]);
  const firstChapter = DEMO_CHAPTERS[0];
  const onRestart = useCallback(() => {
    restartHints();
    restartVisits({ chapterId: firstChapter.id, beatIndex: 0 });
    if (chapter.id === firstChapter.id) {
      replay();
      focusFrame();
      return;
    }
    goToChapter({ id: firstChapter.id });
  }, [restartHints, restartVisits, chapter.id, firstChapter.id, replay, focusFrame, goToChapter]);
  const lastBeatIndex = chapter.beats.length - 1;
  const onPreviousStep = useCallback(() => {
    goTo({ index: Math.max(0, player.beatIndex - 1) });
  }, [goTo, player.beatIndex]);
  const onNextStep = useCallback(() => {
    goTo({ index: Math.min(lastBeatIndex, player.beatIndex + 1) });
  }, [goTo, player.beatIndex, lastBeatIndex]);
  const onToggleHints = useCallback(
    ({ isEnabled }: ToggleHintsParams) => {
      if (isEnabled) {
        showHints();
        return;
      }
      hideHints();
    },
    [showHints, hideHints],
  );
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
    onPreviousStep,
    onNextStep,
    onShowHint: hints.show,
    onFrameShortcut,
  });
  useEscapeLayer(hints.hide, hints.coach !== undefined || hints.offscreen !== undefined);

  const onShown = useCallback(({ key }: ShownParams) => setShownKey(key), []);
  const isSpotlit = hints.coach?.isSpotlit === true;
  const isLastBeat = player.beatIndex === lastBeatIndex;
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
      <DemoTopBar
        theme={theme}
        isQuiet={isSpotlit}
        isHintsEnabled={!hints.isHidden}
        onToggleHints={onToggleHints}
        onRestart={onRestart}
        onToggleTheme={swapTheme}
      />
      <div className="flex min-h-0 flex-1">
        <DemoRail
          chapters={DEMO_CHAPTERS}
          activeId={chapter.id}
          beatIndex={player.beatIndex}
          visits={visits}
          tallyOf={hints.tallyOf}
          onSelect={goToChapter}
          onSelectStep={goTo}
          onIntent={onIntent}
          upNextId={nextChapter?.id}
          isUpNextReady={isGroupDone}
          isQuiet={isSpotlit}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-4 pb-4 pt-2 sm:px-6">
          <DemoChapterHeader
            chapter={chapter}
            tally={hints.tally}
            instruction={headerInstruction({
              chapter,
              beatIndex: player.beatIndex,
              hintInstruction: hints.instruction,
              isGroupDone,
              next: nextChapter,
            })}
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
            })}
          </p>
          <DemoCompactNav
            chapter={chapter}
            groupNumber={chapterIndex + 1}
            groupCount={DEMO_CHAPTERS.length}
            beatIndex={player.beatIndex}
            seen={visits[chapter.id] ?? []}
            hasPrevious={previousChapter !== undefined}
            onPrevious={onPrevious}
            next={nextChapter}
            isNextReady={isGroupDone}
            onNext={onNext}
            onSelectStep={goTo}
          />
        </main>
      </div>
    </div>
  );
};

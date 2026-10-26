import { useCallback, useEffect, useRef, useState } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import { CLOSING_ID } from './closingId';
import { CLOSING_TITLE } from './closingTitle';
import { DEMO_CHAPTERS } from './demoChapters';
import { DEFAULT_GROUP_ID } from './defaultGroupId';
import { DemoTopBar } from './DemoTopBar';
import { DemoRail } from './DemoRail';
import { DemoChapterHeader } from './DemoChapterHeader';
import { DemoClosing } from './DemoClosing';
import { DemoStage, type ShortcutRequest } from './DemoStage';
import { DemoCompactNav } from './DemoCompactNav';
import { useBeatPlayer } from './useBeatPlayer';
import { useChapterHash } from './useChapterHash';
import { useDemoKeys, type FrameShortcutParams } from './useDemoKeys';
import { useDemoTheme } from './useDemoTheme';
import { groupAccessOf } from './hints/groupAccessOf';
import { headerInstruction } from './hints/headerInstruction';
import type { HintTally } from './hints/hintTally';
import { useDemoHints, type DemoHints } from './useDemoHints';
import { useHintProgress } from './useHintProgress';

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

const RAIL_IDS: ReadonlyArray<string> = [...DEMO_CHAPTERS.map((entry) => entry.id), CLOSING_ID];

const NO_TALLY: HintTally = { tried: 0, total: 0 };

const CLOSING_INSTRUCTION = 'Download Goodboy for macOS, or star it on GitHub.';

export const DemoPlayground = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, choose: chooseTheme, toggle: swapTheme } = useDemoTheme();
  const [shortcut, setShortcut] = useState<ShortcutRequest | undefined>(undefined);
  const progressControls = useHintProgress();
  const access = groupAccessOf({ chapters: DEMO_CHAPTERS, progress: progressControls.progress });
  const { chapterId: requestedId, selectChapter } = useChapterHash({
    ids: RAIL_IDS,
    fallbackId: DEFAULT_GROUP_ID,
  });

  const accessOf = ({ id }: ChapterParams) =>
    id === CLOSING_ID ? access.closing : (access.groups.get(id) ?? 'locked');
  const chapterId = accessOf({ id: requestedId }) === 'locked' ? DEFAULT_GROUP_ID : requestedId;
  const isClosing = chapterId === CLOSING_ID;
  const chapterIndex = isClosing
    ? DEMO_CHAPTERS.length - 1
    : Math.max(
        0,
        DEMO_CHAPTERS.findIndex((entry) => entry.id === chapterId),
      );
  const railIndex = isClosing ? RAIL_IDS.length - 1 : chapterIndex;
  const [shownKey, setShownKey] = useState<string | undefined>(undefined);
  const chapter = DEMO_CHAPTERS[chapterIndex] ?? DEMO_CHAPTERS[0];
  const previousId = RAIL_IDS[railIndex - 1];
  const nextId = RAIL_IDS[railIndex + 1];
  const nextChapter = isClosing ? undefined : DEMO_CHAPTERS[chapterIndex + 1];
  const nextTitle = nextId === CLOSING_ID ? CLOSING_TITLE : nextChapter?.title;
  const [intentId, setIntentId] = useState<string | undefined>(undefined);
  const intentChapter =
    intentId === undefined || intentId === chapter.id
      ? undefined
      : DEMO_CHAPTERS.find((entry) => entry.id === intentId);

  const hints = useDemoHints({ chapter, progressControls });
  const isGroupDone = !isClosing && hints.isDone;
  const isNextOpen = nextId !== undefined && accessOf({ id: nextId }) === 'open';
  const upNextId = isGroupDone && isNextOpen ? nextId : undefined;

  const preloadBeat =
    intentChapter?.beats[0] ??
    (hints.nextBeatIndex === undefined ? undefined : chapter.beats[hints.nextBeatIndex]) ??
    (isGroupDone && isNextOpen ? nextChapter?.beats[0] : undefined);
  const player = useBeatPlayer({
    chapter,
    beatIndex: hints.beatIndex,
    preloadBeat,
    theme,
    shownKey,
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
    if (previousId === undefined) {
      return;
    }
    goToChapter({ id: previousId });
  }, [previousId, goToChapter]);

  const isNextLocked = nextId === undefined || accessOf({ id: nextId }) === 'locked';
  const onNext = useCallback(() => {
    if (nextId === undefined || isNextLocked) {
      return;
    }
    goToChapter({ id: nextId });
  }, [nextId, isNextLocked, goToChapter]);

  const { reset: resetHints, restart: restartHints, show: showHints, hide: hideHints } = hints;
  const { replay } = player;
  const onReplay = useCallback(() => {
    resetHints();
    replay();
  }, [resetHints, replay]);
  const firstChapter = DEMO_CHAPTERS[0];
  const onRestart = useCallback(() => {
    restartHints();
    if (chapterId === firstChapter.id) {
      replay();
      focusFrame();
      return;
    }
    goToChapter({ id: firstChapter.id });
  }, [restartHints, chapterId, firstChapter.id, replay, focusFrame, goToChapter]);
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
          activeId={chapterId}
          access={access}
          steps={hints}
          tallyOf={hints.tallyOf}
          onSelect={goToChapter}
          onIntent={onIntent}
          upNextId={upNextId}
          isQuiet={isSpotlit}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-4 pb-4 pt-2 sm:px-6">
          <DemoChapterHeader
            title={isClosing ? CLOSING_TITLE : chapter.title}
            isOptional={!isClosing && chapter.isOptional === true}
            tally={isClosing ? NO_TALLY : hints.tally}
            instruction={
              isClosing
                ? CLOSING_INSTRUCTION
                : headerInstruction({
                    chapter,
                    held: hints.held,
                    active: hints.activeHint,
                    nextTitle: nextTitle ?? CLOSING_TITLE,
                  })
            }
          />
          {isClosing ? (
            <DemoClosing />
          ) : (
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
              onHintReport={hints.onHintReport}
              onHideHint={hints.hide}
              onRevealHint={hints.revealHint}
            />
          )}
          <p className="sr-only" aria-live="polite">
            {hintAnnouncement({
              coach: hints.coach,
              offscreen: hints.offscreen,
            })}
          </p>
          <DemoCompactNav
            title={isClosing ? CLOSING_TITLE : chapter.title}
            chapter={isClosing ? undefined : chapter}
            groupNumber={chapterIndex + 1}
            groupCount={DEMO_CHAPTERS.length}
            steps={hints}
            hasPrevious={previousId !== undefined}
            onPrevious={onPrevious}
            nextTitle={nextTitle}
            isNextReady={upNextId !== undefined}
            isNextLocked={isNextLocked}
            onNext={onNext}
          />
        </main>
      </div>
    </div>
  );
};

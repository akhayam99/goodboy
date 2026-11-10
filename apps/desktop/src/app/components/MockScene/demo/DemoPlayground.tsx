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
import { closingCopyOf } from './closingCopyOf';
import { currentPlatform } from '../../../../shared/platform';
import { DemoStage, type ShortcutRequest } from './DemoStage';
import { DemoCompactNav } from './DemoCompactNav';
import { useBeatPlayer } from './useBeatPlayer';
import { useChapterHash } from './useChapterHash';
import { useDemoKeys, type FrameShortcutParams } from './useDemoKeys';
import { useDemoTheme } from './useDemoTheme';
import { groupAccessOf } from './hints/groupAccessOf';
import { headerInstruction } from './hints/headerInstruction';
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

type SpotlightParams = {
  readonly isOn: boolean;
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

export const DemoPlayground = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [platform] = useState(currentPlatform);
  const closingCopy = closingCopyOf({ platform });
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
  const isRequestedLocked = accessOf({ id: requestedId }) === 'locked';
  const openId =
    DEMO_CHAPTERS.find((entry) => access.groups.get(entry.id) === 'open')?.id ?? DEFAULT_GROUP_ID;
  const chapterId = isRequestedLocked ? openId : requestedId;

  useEffect(() => {
    if (isRequestedLocked) {
      selectChapter({ id: openId, isRedirect: true });
    }
  }, [isRequestedLocked, openId, selectChapter]);

  const isClosing = chapterId === CLOSING_ID;
  const [hasVisitedClosing, setHasVisitedClosing] = useState(false);
  if (isClosing && !hasVisitedClosing) {
    setHasVisitedClosing(true);
  }
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

  const isNextWarm = !isClosing && (hints.activeIndex >= 1 || hints.isDone);
  const preloadBeat =
    intentChapter?.beats[0] ??
    (hints.nextBeatIndex === undefined ? undefined : chapter.beats[hints.nextBeatIndex]) ??
    (isNextWarm ? nextChapter?.beats[0] : undefined);
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
    focusFrame();
  }, [resetHints, replay, focusFrame]);
  const firstChapter = DEMO_CHAPTERS[0];
  const onRestart = useCallback(() => {
    restartHints();
    setHasVisitedClosing(false);
    if (chapterId === firstChapter.id) {
      replay();
      focusFrame();
      return;
    }
    goToChapter({ id: firstChapter.id });
  }, [restartHints, chapterId, firstChapter.id, replay, focusFrame, goToChapter]);
  const onShowHint = useCallback(() => {
    showHints();
    focusFrame();
  }, [showHints, focusFrame]);
  const onToggleHints = useCallback(
    ({ isEnabled }: ToggleHintsParams) => {
      focusFrame();
      if (isEnabled) {
        showHints();
        return;
      }
      hideHints();
    },
    [showHints, hideHints, focusFrame],
  );
  const onFrameShortcut = useCallback(({ code }: FrameShortcutParams) => {
    setShortcut((previous) => ({ code, count: (previous?.count ?? 0) + 1 }));
  }, []);
  const onKeyDown = useDemoKeys({
    onPrevious,
    onNext,
    onReplay,
    onShowHint,
    onFrameShortcut,
  });
  useEscapeLayer(hints.dismiss, hints.coach !== undefined || hints.offscreen !== undefined);

  const onShown = useCallback(({ key }: ShownParams) => setShownKey(key), []);
  const [isSpotlit, setIsSpotlit] = useState(false);
  const onSpotlightChange = useCallback(({ isOn }: SpotlightParams) => setIsSpotlit(isOn), []);

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
        isClosing={isClosing}
        isHintsEnabled={!hints.isHidden}
        isHintDismissed={hints.isDismissed}
        onShowHint={onShowHint}
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
          isClosingVisited={hasVisitedClosing}
          isQuiet={isSpotlit}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-4 pb-5 pt-4 xl:pl-2 xl:pr-5">
          <DemoChapterHeader
            title={isClosing ? CLOSING_TITLE : chapter.title}
            instruction={
              isClosing
                ? closingCopy.instruction
                : headerInstruction({
                    held: hints.held,
                    acting: hints.acting,
                    active: hints.activeHint,
                    nextTitle: nextTitle ?? CLOSING_TITLE,
                    isRecovering: hints.isRecovering,
                  })
            }
          />
          {isClosing ? (
            <DemoClosing
              copy={closingCopy}
              theme={theme}
              groups={DEMO_CHAPTERS}
              onRestart={onRestart}
            />
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
              offscreen={hints.acting === undefined ? hints.offscreen : undefined}
              reveal={hints.reveal}
              onHintReport={hints.onHintReport}
              onSpotlightChange={onSpotlightChange}
              onHideHint={hints.dismiss}
              onRevealHint={hints.revealHint}
              working={hints.acting?.progressCopy ?? hints.acting?.progress}
              done={
                isGroupDone
                  ? {
                      title: chapter.title,
                      outro: chapter.outro,
                      nextTitle: nextTitle ?? CLOSING_TITLE,
                    }
                  : undefined
              }
              onNext={onNext}
              onReplay={onReplay}
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

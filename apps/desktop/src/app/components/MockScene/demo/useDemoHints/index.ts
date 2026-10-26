import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DemoChapter } from '../demoChapters';
import type { CoachMark } from '../DemoCoachMark';
import type { DemoHintReport, DemoRect } from '../director/demoProtocol';
import type { DemoHint } from '../hints/demoHintTypes';
import type { HintProgress } from '../hints/hintProgressTypes';
import { hintTally, type HintTally } from '../hints/hintTally';
import { RESULT_DWELL_MS } from '../hints/resultDwellMs';
import { stepsOf, type Steps } from '../hints/stepsOf';
import type { HintProgressControls } from '../useHintProgress';
import { useHintsEnabled } from '../useHintsEnabled';

type Params = {
  readonly chapter: DemoChapter;
  readonly progressControls: HintProgressControls;
};

export type HintTrack = {
  readonly chapterId: string;
  readonly settledIds: ReadonlyArray<string>;
};

export type HintReportParams = {
  readonly key: string;
  readonly report: DemoHintReport;
};

type TallyParams = {
  readonly chapter: DemoChapter;
};

type AnchorState = {
  readonly chapterId: string;
  readonly hintId: string | null;
  readonly rect: DemoRect | null;
  readonly focus: DemoRect | null;
  readonly isOffscreen: boolean;
  readonly isClicked: boolean;
};

type Hold = {
  readonly chapterId: string;
  readonly hintId: string;
  readonly phase: 'show' | 'wait';
};

export type OffscreenHint = {
  readonly hintId: string;
  readonly copy: string;
};

export type HintReveal = {
  readonly hintId: string;
  readonly count: number;
};

export type DemoHints = Steps & {
  readonly track: HintTrack | undefined;
  readonly coach: CoachMark | undefined;
  readonly offscreen: OffscreenHint | undefined;
  readonly progress: HintProgress;
  readonly held: DemoHint | undefined;
  readonly acting: DemoHint | undefined;
  readonly beatIndex: number;
  readonly nextBeatIndex: number | undefined;
  readonly reveal: HintReveal | undefined;
  readonly tally: HintTally;
  readonly isHidden: boolean;
  readonly tallyOf: (params: TallyParams) => HintTally;
  readonly onHintReport: (params: HintReportParams) => void;
  readonly hide: () => void;
  readonly show: () => void;
  readonly revealHint: () => void;
  readonly reset: () => void;
  readonly restart: () => void;
};

const HOLD_WAIT_MS = 20000;

export const useDemoHints = ({ chapter, progressControls }: Params): DemoHints => {
  const {
    progress,
    markTried,
    reset: resetProgress,
    resetAll: resetAllProgress,
  } = progressControls;
  const { isEnabled, setEnabled } = useHintsEnabled();
  const [anchor, setAnchor] = useState<AnchorState | null>(null);
  const [reveal, setReveal] = useState<HintReveal | undefined>(undefined);
  const [hold, setHold] = useState<Hold | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const { hints } = chapter;
  const steps = stepsOf({ chapter, progress });
  const { activeHint } = steps;
  const activeIdRef = useRef<string | undefined>(activeHint?.id);
  activeIdRef.current = activeHint?.id;
  const anchorIdRef = useRef<string | null>(null);

  const settledKey = [...steps.doneIds].sort().join(' ');

  const track = useMemo((): HintTrack | undefined => {
    if (hints.length === 0) {
      return undefined;
    }
    const ids = new Set(hints.map((hint) => hint.id));
    return {
      chapterId: chapter.id,
      settledIds: settledKey.length > 0 ? settledKey.split(' ').filter((id) => ids.has(id)) : [],
    };
  }, [hints, chapter.id, settledKey]);

  useEffect(() => {
    if (hold === null) {
      return;
    }
    const isShowing = hold.phase === 'show';
    const timer = window.setTimeout(
      () => {
        const isNextShown =
          activeIdRef.current === undefined || anchorIdRef.current === activeIdRef.current;
        if (isShowing && !isNextShown) {
          setHold((previous) => (previous === hold ? { ...hold, phase: 'wait' } : previous));
          return;
        }
        setHold((previous) => (previous === hold ? null : previous));
      },
      isShowing ? RESULT_DWELL_MS : HOLD_WAIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [hold]);

  const onHintReport = useCallback(
    ({ report }: HintReportParams) => {
      if (report.hintId !== null && !hints.some((hint) => hint.id === report.hintId)) {
        return;
      }
      if (report.type === 'tried') {
        if (report.hintId !== activeIdRef.current) {
          return;
        }
        markTried({ chapterId: chapter.id, hintId: report.hintId });
        setHold({ chapterId: chapter.id, hintId: report.hintId, phase: 'show' });
        return;
      }
      anchorIdRef.current = report.hintId;
      if (report.hintId !== null && report.hintId === activeIdRef.current) {
        setHold((previous) => (previous?.phase === 'wait' ? null : previous));
        if (report.isClicked === true) {
          setActingId(report.hintId);
        }
      }
      setAnchor({
        chapterId: chapter.id,
        hintId: report.hintId,
        rect: report.rect,
        focus: report.focus ?? null,
        isOffscreen: report.isOffscreen,
        isClicked: report.isClicked === true,
      });
    },
    [hints, chapter.id, markTried],
  );

  const held =
    hold !== null && hold.chapterId === chapter.id
      ? hints.find((hint) => hint.id === hold.hintId)
      : undefined;
  const isFrameHeld = held !== undefined && hold?.phase === 'show';
  const frameHint = isFrameHeld ? held : (activeHint ?? hints.at(-1));
  const beatIndex = frameHint?.beat ?? 0;
  const frameHintIndex = hints.findIndex((hint) => hint.id === frameHint?.id);
  const nextBeatIndex = hints
    .slice(frameHintIndex + 1)
    .find((hint) => hint.beat !== beatIndex)?.beat;

  useEffect(() => {
    setAnchor(null);
  }, [beatIndex, chapter.id]);

  const acting = actingId !== null && actingId === activeHint?.id ? activeHint : undefined;

  const current = anchor !== null && anchor.chapterId === chapter.id ? anchor : null;
  const isActive = current !== null && current.hintId === activeHint?.id;
  const isOpen = activeHint !== undefined && isActive && isEnabled;

  const coach = useMemo((): CoachMark | undefined => {
    if (!isOpen || activeHint === undefined || current === null || current.rect === null) {
      return undefined;
    }
    if (current.isClicked) {
      return undefined;
    }
    return {
      hintId: activeHint.id,
      copy: activeHint.copy,
      side: activeHint.side ?? 'right',
      rect: current.rect,
      focus: current.focus,
    };
  }, [isOpen, activeHint, current]);

  const offscreen = useMemo((): OffscreenHint | undefined => {
    if (!isOpen || activeHint === undefined || current === null || !current.isOffscreen) {
      return undefined;
    }
    return { hintId: activeHint.id, copy: activeHint.copy };
  }, [isOpen, activeHint, current]);

  const hide = useCallback(() => setEnabled({ isEnabled: false }), [setEnabled]);

  const show = useCallback(() => setEnabled({ isEnabled: true }), [setEnabled]);

  const revealHint = useCallback(() => {
    if (activeHint === undefined) {
      return;
    }
    setReveal((previous) => ({ hintId: activeHint.id, count: (previous?.count ?? 0) + 1 }));
  }, [activeHint]);

  const reset = useCallback(() => {
    resetProgress({ chapterId: chapter.id });
    setAnchor(null);
    setHold(null);
    setActingId(null);
  }, [resetProgress, chapter.id]);

  const restart = useCallback(() => {
    resetAllProgress();
    setAnchor(null);
    setHold(null);
    setActingId(null);
  }, [resetAllProgress]);

  const tallyOf = useCallback(
    ({ chapter: target }: TallyParams) => hintTally({ chapter: target, progress }),
    [progress],
  );

  return {
    ...steps,
    progress,
    track,
    coach,
    offscreen,
    held,
    acting,
    beatIndex,
    nextBeatIndex,
    reveal,
    tally: hintTally({ chapter, progress }),
    isHidden: !isEnabled,
    tallyOf,
    onHintReport,
    hide,
    show,
    revealHint,
    reset,
    restart,
  };
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DemoChapter } from '../demoChapters';
import type { CoachMark } from '../DemoCoachMark';
import type { DemoHintReport, DemoRect } from '../director/demoProtocol';
import type { DemoHint } from '../hints/demoHintTypes';
import type { HintProgress } from '../hints/hintProgressTypes';
import { hintTally, type HintTally } from '../hints/hintTally';
import { dwellOf } from '../hints/dwellOf';
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
  readonly isGuarding: boolean;
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
  readonly opened: ReadonlyArray<DemoRect>;
  readonly isOffscreen: boolean;
  readonly isClicked: boolean;
  readonly isPressed: boolean;
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
  readonly dismiss: () => void;
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
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pulse, setPulse] = useState(0);

  const { hints } = chapter;
  const steps = stepsOf({ chapter, progress });
  const { activeHint } = steps;
  const activeIdRef = useRef<string | undefined>(activeHint?.id);
  activeIdRef.current = activeHint?.id;
  const anchorIdRef = useRef<string | null>(null);
  const doneIdsRef = useRef(steps.doneIds);
  doneIdsRef.current = steps.doneIds;
  const pendingIdsRef = useRef(new Set<string>());

  const settledKey = [...steps.doneIds].sort().join(' ');

  useEffect(() => {
    pendingIdsRef.current.clear();
  }, [settledKey, chapter.id]);

  const track = useMemo((): HintTrack | undefined => {
    if (hints.length === 0) {
      return undefined;
    }
    const ids = new Set(hints.map((hint) => hint.id));
    return {
      chapterId: chapter.id,
      settledIds: settledKey.length > 0 ? settledKey.split(' ').filter((id) => ids.has(id)) : [],
      isGuarding: isEnabled,
    };
  }, [hints, chapter.id, settledKey, isEnabled]);

  useEffect(() => {
    if (hold === null) {
      return;
    }
    const isShowing = hold.phase === 'show';
    const heldHint = hints.find((hint) => hint.id === hold.hintId);
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
      isShowing
        ? heldHint === undefined
          ? RESULT_DWELL_MS
          : dwellOf({ hint: heldHint })
        : HOLD_WAIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [hold, hints]);

  const onHintReport = useCallback(
    ({ report }: HintReportParams) => {
      if (report.hintId !== null && !hints.some((hint) => hint.id === report.hintId)) {
        return;
      }
      if (report.type === 'blocked') {
        if (report.hintId !== activeIdRef.current) {
          return;
        }
        const blockedId = report.hintId;
        setDismissedIds((previous) => {
          if (!previous.has(blockedId)) {
            return previous;
          }
          return new Set([...previous].filter((id) => id !== blockedId));
        });
        setPulse((previous) => previous + 1);
        return;
      }
      if (report.type === 'tried') {
        const expected = hints.find(
          (hint) => !doneIdsRef.current.has(hint.id) && !pendingIdsRef.current.has(hint.id),
        );
        if (report.hintId !== expected?.id) {
          return;
        }
        pendingIdsRef.current.add(report.hintId);
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
        opened: report.opened ?? [],
        isOffscreen: report.isOffscreen,
        isClicked: report.isClicked === true,
        isPressed: report.isPressed === true,
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
  const isDismissed = activeHint !== undefined && dismissedIds.has(activeHint.id);
  const isOpen = activeHint !== undefined && isActive && isEnabled && !isDismissed;

  const coach = useMemo((): CoachMark | undefined => {
    if (!isOpen || activeHint === undefined || current === null || current.rect === null) {
      return undefined;
    }
    if (current.isPressed) {
      return undefined;
    }
    return {
      hintId: activeHint.id,
      copy: acting?.progressCopy ?? activeHint.copy,
      side: activeHint.side,
      isSideLocked: activeHint.isSideLocked === true,
      rect: current.rect,
      focus: current.focus,
      opened: current.opened,
      isDimmed: activeHint.isDimmed !== false,
      pulse,
    };
  }, [isOpen, activeHint, acting, current, pulse]);

  const offscreen = useMemo((): OffscreenHint | undefined => {
    if (!isOpen || activeHint === undefined || current === null || !current.isOffscreen) {
      return undefined;
    }
    return { hintId: activeHint.id, copy: activeHint.copy };
  }, [isOpen, activeHint, current]);

  const hide = useCallback(() => setEnabled({ isEnabled: false }), [setEnabled]);

  const dismiss = useCallback(() => {
    const id = activeIdRef.current;
    if (id === undefined) {
      return;
    }
    setDismissedIds((previous) => new Set([...previous, id]));
  }, []);

  const show = useCallback(() => {
    setDismissedIds(new Set());
    setEnabled({ isEnabled: true });
  }, [setEnabled]);

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
    setDismissedIds(new Set());
  }, [resetProgress, chapter.id]);

  const restart = useCallback(() => {
    resetAllProgress();
    setAnchor(null);
    setHold(null);
    setActingId(null);
    setDismissedIds(new Set());
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
    dismiss,
    show,
    revealHint,
    reset,
    restart,
  };
};

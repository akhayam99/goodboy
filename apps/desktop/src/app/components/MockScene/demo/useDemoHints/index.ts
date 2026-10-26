import { useCallback, useMemo, useState } from 'react';
import type { DemoChapter } from '../demoChapters';
import type { CoachMark } from '../DemoCoachMark';
import type { DemoHintReport, DemoRect } from '../director/demoProtocol';
import { hintTally, type HintTally } from '../hints/hintTally';
import { isHoleTooBig } from '../hints/isHoleTooBig';
import { APP_SIZE } from '../appSize';
import { useHintProgress } from '../useHintProgress';
import { useHintsEnabled } from '../useHintsEnabled';

type Params = {
  readonly chapter: DemoChapter;
  readonly frameKey: string;
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
  readonly key: string;
  readonly chapterId: string;
  readonly hintId: string | null;
  readonly rect: DemoRect | null;
  readonly focus: DemoRect | null;
  readonly isOffscreen: boolean;
  readonly isClicked: boolean;
};

export type OffscreenHint = {
  readonly hintId: string;
  readonly copy: string;
};

export type HintReveal = {
  readonly hintId: string;
  readonly count: number;
};

export type DemoHints = {
  readonly track: HintTrack | undefined;
  readonly coach: CoachMark | undefined;
  readonly offscreen: OffscreenHint | undefined;
  readonly instruction: string | undefined;
  readonly reveal: HintReveal | undefined;
  readonly tally: HintTally;
  readonly isHidden: boolean;
  readonly tallyOf: (params: TallyParams) => HintTally;
  readonly onHintReport: (params: HintReportParams) => void;
  readonly skip: () => void;
  readonly hide: () => void;
  readonly show: () => void;
  readonly revealHint: () => void;
  readonly reset: () => void;
  readonly restart: () => void;
};

export const useDemoHints = ({ chapter, frameKey }: Params): DemoHints => {
  const {
    progress,
    markTried,
    markSkipped,
    reset: resetProgress,
    resetAll: resetAllProgress,
    unskip,
  } = useHintProgress();
  const { isEnabled, setEnabled } = useHintsEnabled();
  const [anchor, setAnchor] = useState<AnchorState | null>(null);
  const [reveal, setReveal] = useState<HintReveal | undefined>(undefined);

  const hints = useMemo(() => chapter.hints ?? [], [chapter]);
  const chapterProgress = progress[chapter.id];
  const settledKey = [...(chapterProgress?.tried ?? []), ...(chapterProgress?.skipped ?? [])]
    .filter((id) => hints.some((hint) => hint.id === id))
    .sort()
    .join(' ');

  const track = useMemo((): HintTrack | undefined => {
    if (hints.length === 0) {
      return undefined;
    }
    return {
      chapterId: chapter.id,
      settledIds: settledKey.length > 0 ? settledKey.split(' ') : [],
    };
  }, [hints, chapter.id, settledKey]);

  const onHintReport = useCallback(
    ({ key, report }: HintReportParams) => {
      if (report.type === 'place') {
        return;
      }
      if (report.hintId !== null && !hints.some((hint) => hint.id === report.hintId)) {
        return;
      }
      if (report.type === 'tried') {
        markTried({ chapterId: chapter.id, hintId: report.hintId });
        return;
      }
      setAnchor({
        key,
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

  const current =
    anchor !== null && anchor.key === frameKey && anchor.chapterId === chapter.id ? anchor : null;
  const currentId = current?.hintId ?? null;
  const isSettled = track?.settledIds.includes(currentId ?? '') ?? false;
  const index = hints.findIndex((entry) => entry.id === currentId);
  const hint = hints.find((entry) => entry.id === currentId);
  const isHidden = !isEnabled;

  const isOpen = hint !== undefined && current !== null && !isSettled && isEnabled;
  const instruction = isOpen ? hint.instruction : undefined;

  const coach = useMemo((): CoachMark | undefined => {
    if (!isOpen || hint === undefined || current === null || current.rect === null) {
      return undefined;
    }
    return {
      hintId: hint.id,
      copy: hint.copy,
      step: index + 1,
      total: hints.length,
      side: hint.side ?? 'right',
      rect: current.rect,
      focus: current.focus,
      isSpotlit:
        !current.isClicked &&
        !isHoleTooBig({ anchor: current.rect, focus: current.focus, bounds: APP_SIZE }),
    };
  }, [isOpen, hint, current, index, hints.length]);

  const offscreen = useMemo((): OffscreenHint | undefined => {
    if (!isOpen || hint === undefined || current === null || !current.isOffscreen) {
      return undefined;
    }
    return { hintId: hint.id, copy: hint.copy };
  }, [isOpen, hint, current]);

  const skip = useCallback(() => {
    if (currentId === null) {
      return;
    }
    markSkipped({ chapterId: chapter.id, hintId: currentId });
  }, [currentId, chapter.id, markSkipped]);

  const hide = useCallback(() => setEnabled({ isEnabled: false }), [setEnabled]);

  const show = useCallback(() => {
    unskip({ chapterId: chapter.id });
    setEnabled({ isEnabled: true });
  }, [unskip, chapter.id, setEnabled]);

  const revealHint = useCallback(() => {
    if (currentId === null) {
      return;
    }
    setReveal((previous) => ({ hintId: currentId, count: (previous?.count ?? 0) + 1 }));
  }, [currentId]);

  const reset = useCallback(() => {
    resetProgress({ chapterId: chapter.id });
    setAnchor(null);
  }, [resetProgress, chapter.id]);

  const restart = useCallback(() => {
    resetAllProgress();
    setAnchor(null);
  }, [resetAllProgress]);

  const tallyOf = useCallback(
    ({ chapter: target }: TallyParams) => hintTally({ chapter: target, progress }),
    [progress],
  );

  return {
    track,
    coach,
    offscreen,
    instruction,
    reveal,
    tally: hintTally({ chapter, progress }),
    isHidden,
    tallyOf,
    onHintReport,
    skip,
    hide,
    show,
    revealHint,
    reset,
    restart,
  };
};

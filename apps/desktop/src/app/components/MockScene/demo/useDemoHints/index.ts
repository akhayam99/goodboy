import { useCallback, useMemo, useState } from 'react';
import type { DemoChapter } from '../demoChapters';
import type { CoachMark } from '../DemoCoachMark';
import type { DemoHintReport, DemoRect } from '../director/demoProtocol';
import { hintTally, type HintTally } from '../hints/hintTally';
import { useHintProgress } from '../useHintProgress';

type Params = {
  readonly chapter: DemoChapter;
  readonly chapters: ReadonlyArray<DemoChapter>;
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
};

export const useDemoHints = ({ chapter, chapters, frameKey }: Params): DemoHints => {
  const { progress, markTried, markSkipped, reset: resetProgress } = useHintProgress();
  const [anchor, setAnchor] = useState<AnchorState | null>(null);
  const [hiddenId, setHiddenId] = useState<string | null>(null);
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
  const steps = hints.filter((entry) => entry.nextChapterId === undefined);
  const index = steps.findIndex((entry) => entry.id === currentId);
  const hint = hints.find((entry) => entry.id === currentId);
  const isHidden = currentId !== null && !isSettled && hiddenId === currentId;

  const isOpen = hint !== undefined && current !== null && !isSettled && !isHidden;
  const nextChapter =
    hint?.nextChapterId === undefined
      ? undefined
      : chapters.find((entry) => entry.id === hint.nextChapterId);

  const coach = useMemo((): CoachMark | undefined => {
    if (!isOpen || hint === undefined || current === null || current.rect === null) {
      return undefined;
    }
    return {
      hintId: hint.id,
      copy: hint.copy,
      step: index + 1,
      total: steps.length,
      side: hint.side ?? 'right',
      rect: current.rect,
      focus: current.focus,
      isSpotlit: nextChapter === undefined && !current.isClicked,
      next:
        nextChapter === undefined ? undefined : { id: nextChapter.id, title: nextChapter.title },
    };
  }, [isOpen, hint, current, index, steps.length, nextChapter]);

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

  const hide = useCallback(() => {
    if (currentId === null) {
      return;
    }
    setHiddenId(currentId);
  }, [currentId]);

  const show = useCallback(() => setHiddenId(null), []);

  const revealHint = useCallback(() => {
    if (currentId === null) {
      return;
    }
    setReveal((previous) => ({ hintId: currentId, count: (previous?.count ?? 0) + 1 }));
  }, [currentId]);

  const reset = useCallback(() => {
    resetProgress({ chapterId: chapter.id });
    setAnchor(null);
    setHiddenId(null);
  }, [resetProgress, chapter.id]);

  const tallyOf = useCallback(
    ({ chapter: target }: TallyParams) => hintTally({ chapter: target, progress }),
    [progress],
  );

  return {
    track,
    coach,
    offscreen,
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
  };
};

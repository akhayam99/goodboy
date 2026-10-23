import { useCallback, useMemo, useState } from 'react';
import type { DemoChapter } from '../demoChapters';
import type { CoachMark } from '../DemoCoachMark';
import type { DemoHintReport, DemoRect } from '../director/demoProtocol';
import { hintTally, type HintTally } from '../hints/hintTally';
import { useHintProgress } from '../useHintProgress';

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
};

export type DemoHints = {
  readonly track: HintTrack | undefined;
  readonly coach: CoachMark | undefined;
  readonly tally: HintTally;
  readonly isHidden: boolean;
  readonly tallyOf: (params: TallyParams) => HintTally;
  readonly onHintReport: (params: HintReportParams) => void;
  readonly skip: () => void;
  readonly hide: () => void;
  readonly show: () => void;
  readonly reset: () => void;
};

export const useDemoHints = ({ chapter, frameKey }: Params): DemoHints => {
  const { progress, markTried, markSkipped, reset: resetProgress } = useHintProgress();
  const [anchor, setAnchor] = useState<AnchorState | null>(null);
  const [hiddenId, setHiddenId] = useState<string | null>(null);

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
      if (report.hintId !== null && !hints.some((hint) => hint.id === report.hintId)) {
        return;
      }
      if (report.type === 'tried') {
        markTried({ chapterId: chapter.id, hintId: report.hintId });
        return;
      }
      setAnchor({ key, chapterId: chapter.id, hintId: report.hintId, rect: report.rect });
    },
    [hints, chapter.id, markTried],
  );

  const current =
    anchor !== null && anchor.key === frameKey && anchor.chapterId === chapter.id ? anchor : null;
  const currentId = current?.hintId ?? null;
  const isSettled = track?.settledIds.includes(currentId ?? '') ?? false;
  const index = hints.findIndex((hint) => hint.id === currentId);
  const hint = hints[index];
  const isHidden = currentId !== null && !isSettled && hiddenId === currentId;

  const coach = useMemo((): CoachMark | undefined => {
    if (hint === undefined || current === null || current.rect === null) {
      return undefined;
    }
    if (isSettled || isHidden) {
      return undefined;
    }
    return {
      hintId: hint.id,
      copy: hint.copy,
      step: index + 1,
      total: hints.length,
      side: hint.side ?? 'right',
      rect: current.rect,
    };
  }, [hint, current, isSettled, isHidden, index, hints.length]);

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
    tally: hintTally({ chapter, progress }),
    isHidden,
    tallyOf,
    onHintReport,
    skip,
    hide,
    show,
    reset,
  };
};

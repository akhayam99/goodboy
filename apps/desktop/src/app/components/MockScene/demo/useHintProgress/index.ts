import { useCallback, useRef, useState } from 'react';
import type { ChapterHintProgress, HintProgress } from '../hints/hintProgressTypes';
import { readHintProgress } from '../hints/readHintProgress';
import { writeHintProgress } from '../hints/writeHintProgress';

type MarkParams = {
  readonly chapterId: string;
  readonly hintId: string;
};

type ResetParams = {
  readonly chapterId: string;
};

export type HintProgressControls = {
  readonly progress: HintProgress;
  readonly markTried: (params: MarkParams) => void;
  readonly reset: (params: ResetParams) => void;
  readonly resetAll: () => void;
};

type AddParams = MarkParams & {
  readonly progress: HintProgress;
  readonly epoch: number;
};

type ChangeParams = {
  readonly progress: HintProgress;
};

type ApplyParams = {
  readonly change: (params: ChangeParams) => HintProgress;
};

const EMPTY: ChapterHintProgress = { tried: [], epoch: 0 };

const withHint = ({ progress, chapterId, hintId, epoch }: AddParams): HintProgress => {
  const chapter = progress[chapterId] ?? EMPTY;
  if (chapter.epoch !== epoch || chapter.tried.includes(hintId)) {
    return progress;
  }
  return { ...progress, [chapterId]: { ...chapter, tried: [...chapter.tried, hintId] } };
};

const withoutChapter = ({ progress, chapterId }: ChangeParams & ResetParams): HintProgress => {
  const epoch = (progress[chapterId]?.epoch ?? 0) + 1;
  return { ...progress, [chapterId]: { tried: [], epoch } };
};

const withoutAnyProgress = ({ progress }: ChangeParams): HintProgress =>
  Object.fromEntries(
    Object.entries(progress).map(([chapterId, chapter]) => [
      chapterId,
      { tried: [], epoch: chapter.epoch + 1 },
    ]),
  );

const initial = (): HintProgress => readHintProgress({ fallback: {} });

export const useHintProgress = (): HintProgressControls => {
  const [progress, setProgress] = useState<HintProgress>(initial);
  const latest = useRef(progress);

  const adopt = useCallback(({ progress: next }: ChangeParams) => {
    latest.current = next;
    setProgress(next);
  }, []);

  const apply = useCallback(
    ({ change }: ApplyParams) => {
      const stored = readHintProgress({ fallback: latest.current });
      const next = change({ progress: stored });
      if (next !== stored) {
        writeHintProgress({ progress: next });
      }
      adopt({ progress: next });
    },
    [adopt],
  );

  const markTried = useCallback(
    ({ chapterId, hintId }: MarkParams) => {
      const epoch = latest.current[chapterId]?.epoch ?? 0;
      apply({
        change: ({ progress: stored }) => withHint({ progress: stored, chapterId, hintId, epoch }),
      });
    },
    [apply],
  );

  const reset = useCallback(
    ({ chapterId }: ResetParams) => {
      apply({ change: ({ progress: stored }) => withoutChapter({ progress: stored, chapterId }) });
    },
    [apply],
  );

  const resetAll = useCallback(() => {
    apply({ change: ({ progress: stored }) => withoutAnyProgress({ progress: stored }) });
  }, [apply]);

  return { progress, markTried, reset, resetAll };
};

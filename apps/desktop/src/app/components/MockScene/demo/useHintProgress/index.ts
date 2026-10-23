import { useCallback, useEffect, useRef, useState } from 'react';
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
  readonly markSkipped: (params: MarkParams) => void;
  readonly reset: (params: ResetParams) => void;
};

type AddParams = {
  readonly progress: HintProgress;
  readonly chapterId: string;
  readonly hintId: string;
  readonly list: keyof ChapterHintProgress;
};

const EMPTY: ChapterHintProgress = { tried: [], skipped: [] };

const withHint = ({ progress, chapterId, hintId, list }: AddParams): HintProgress => {
  const chapter = progress[chapterId] ?? EMPTY;
  if (chapter[list].includes(hintId)) {
    return progress;
  }
  return { ...progress, [chapterId]: { ...chapter, [list]: [...chapter[list], hintId] } };
};

export const useHintProgress = (): HintProgressControls => {
  const [progress, setProgress] = useState<HintProgress>(readHintProgress);

  const stored = useRef(progress);

  useEffect(() => {
    if (stored.current === progress) {
      return;
    }
    stored.current = progress;
    writeHintProgress({ progress });
  }, [progress]);

  const markTried = useCallback(({ chapterId, hintId }: MarkParams) => {
    setProgress((previous) => withHint({ progress: previous, chapterId, hintId, list: 'tried' }));
  }, []);

  const markSkipped = useCallback(({ chapterId, hintId }: MarkParams) => {
    setProgress((previous) => withHint({ progress: previous, chapterId, hintId, list: 'skipped' }));
  }, []);

  const reset = useCallback(({ chapterId }: ResetParams) => {
    setProgress((previous) => {
      if (previous[chapterId] === undefined) {
        return previous;
      }
      return Object.fromEntries(Object.entries(previous).filter(([id]) => id !== chapterId));
    });
  }, []);

  return { progress, markTried, markSkipped, reset };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChapterHintProgress, HintProgress } from '../hints/hintProgressTypes';
import { HINT_PROGRESS_KEY } from '../hints/hintProgressKey';
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

type AddParams = MarkParams & {
  readonly progress: HintProgress;
  readonly list: 'tried' | 'skipped';
  readonly epoch: number;
};

type ChangeParams = {
  readonly progress: HintProgress;
};

type ApplyParams = {
  readonly change: (params: ChangeParams) => HintProgress;
};

const EMPTY: ChapterHintProgress = { tried: [], skipped: [], epoch: 0 };

const withHint = ({ progress, chapterId, hintId, list, epoch }: AddParams): HintProgress => {
  const chapter = progress[chapterId] ?? EMPTY;
  if (chapter.epoch !== epoch || chapter[list].includes(hintId)) {
    return progress;
  }
  return { ...progress, [chapterId]: { ...chapter, [list]: [...chapter[list], hintId] } };
};

const withoutChapter = ({ progress, chapterId }: ChangeParams & ResetParams): HintProgress => {
  const epoch = (progress[chapterId]?.epoch ?? 0) + 1;
  return { ...progress, [chapterId]: { tried: [], skipped: [], epoch } };
};

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

  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== null && event.key !== HINT_PROGRESS_KEY) {
        return;
      }
      adopt({ progress: readHintProgress({ fallback: latest.current }) });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [adopt]);

  const mark = useCallback(
    ({ chapterId, hintId, list }: MarkParams & Pick<AddParams, 'list'>) => {
      const epoch = latest.current[chapterId]?.epoch ?? 0;
      apply({
        change: ({ progress: stored }) =>
          withHint({ progress: stored, chapterId, hintId, list, epoch }),
      });
    },
    [apply],
  );

  const markTried = useCallback(
    ({ chapterId, hintId }: MarkParams) => mark({ chapterId, hintId, list: 'tried' }),
    [mark],
  );

  const markSkipped = useCallback(
    ({ chapterId, hintId }: MarkParams) => mark({ chapterId, hintId, list: 'skipped' }),
    [mark],
  );

  const reset = useCallback(
    ({ chapterId }: ResetParams) => {
      apply({ change: ({ progress: stored }) => withoutChapter({ progress: stored, chapterId }) });
    },
    [apply],
  );

  return { progress, markTried, markSkipped, reset };
};

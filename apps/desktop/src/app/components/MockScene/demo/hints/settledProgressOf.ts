import type { DemoChapter } from '../demoChapters';
import type { ChapterHintProgress, HintProgress } from './hintProgressTypes';
import { stepsOf } from './stepsOf';

type Params = {
  readonly chapters: ReadonlyArray<DemoChapter>;
  readonly progress: HintProgress;
};

type ChapterParams = {
  readonly chapter: DemoChapter | undefined;
  readonly stored: ChapterHintProgress;
  readonly progress: HintProgress;
};

const isUnfinished = ({ chapter, stored, progress }: ChapterParams): boolean =>
  chapter !== undefined && stored.tried.length > 0 && !stepsOf({ chapter, progress }).isDone;

export const settledProgressOf = ({ chapters, progress }: Params): HintProgress => {
  const entries = Object.entries(progress);
  const hasUnfinished = entries.some(([chapterId, stored]) =>
    isUnfinished({ chapter: chapters.find((entry) => entry.id === chapterId), stored, progress }),
  );
  if (!hasUnfinished) {
    return progress;
  }
  return Object.fromEntries(
    entries.map(([chapterId, stored]) => [
      chapterId,
      isUnfinished({ chapter: chapters.find((entry) => entry.id === chapterId), stored, progress })
        ? { tried: [], epoch: stored.epoch }
        : stored,
    ]),
  );
};

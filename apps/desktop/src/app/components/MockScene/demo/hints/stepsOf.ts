import type { DemoChapter } from '../demoChapters';
import type { DemoHint } from './demoHintTypes';
import type { HintProgress } from './hintProgressTypes';

type Params = {
  readonly chapter: DemoChapter;
  readonly progress: HintProgress;
};

export type Steps = {
  readonly doneIds: ReadonlySet<string>;
  readonly activeIndex: number;
  readonly activeHint: DemoHint | undefined;
  readonly isDone: boolean;
};

export const stepsOf = ({ chapter, progress }: Params): Steps => {
  const doneIds = new Set(progress[chapter.id]?.tried ?? []);
  const activeIndex = chapter.hints.findIndex((hint) => !doneIds.has(hint.id));
  return {
    doneIds,
    activeIndex,
    activeHint: chapter.hints[activeIndex],
    isDone: chapter.hints.length > 0 && activeIndex < 0,
  };
};

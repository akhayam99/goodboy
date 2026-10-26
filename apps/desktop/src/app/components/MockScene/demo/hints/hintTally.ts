import type { DemoChapter } from '../demoChapters';
import type { HintProgress } from './hintProgressTypes';

type Params = {
  readonly chapter: DemoChapter;
  readonly progress: HintProgress;
};

export type HintTally = {
  readonly tried: number;
  readonly total: number;
};

export const hintTally = ({ chapter, progress }: Params): HintTally => {
  const tried = new Set(progress[chapter.id]?.tried ?? []);
  return {
    tried: chapter.hints.filter((hint) => tried.has(hint.id)).length,
    total: chapter.hints.length,
  };
};

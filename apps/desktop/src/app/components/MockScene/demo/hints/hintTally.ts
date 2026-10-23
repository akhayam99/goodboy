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
  const hints = chapter.hints ?? [];
  const tried = new Set(progress[chapter.id]?.tried ?? []);
  const outcomes = new Set(hints.flatMap((hint) => (hint.outcome === null ? [] : [hint.outcome])));
  const reached = new Set(
    hints.flatMap((hint) => (hint.outcome !== null && tried.has(hint.id) ? [hint.outcome] : [])),
  );
  return { tried: reached.size, total: outcomes.size };
};

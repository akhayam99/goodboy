import type { DemoChapter } from '../demoChapters';
import type { HintTally } from './hintTally';

type TallyParams = {
  readonly chapter: DemoChapter;
};

type Params = {
  readonly chapters: ReadonlyArray<DemoChapter>;
  readonly tallyOf: (params: TallyParams) => HintTally;
};

export const isEveryGroupTried = ({ chapters, tallyOf }: Params): boolean => {
  const tallies = chapters
    .map((chapter) => tallyOf({ chapter }))
    .filter((tally) => tally.total > 0);
  return tallies.length > 0 && tallies.every((tally) => tally.tried >= tally.total);
};

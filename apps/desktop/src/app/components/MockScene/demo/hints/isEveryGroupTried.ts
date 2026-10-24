import type { DemoChapter } from '../demoChapters';
import type { HintTally } from './hintTally';

type TallyParams = {
  readonly chapter: DemoChapter;
};

type Params = {
  readonly chapters: ReadonlyArray<DemoChapter>;
  readonly tallyOf: (params: TallyParams) => HintTally;
  readonly visitedIds: ReadonlyArray<string>;
};

export const isEveryGroupTried = ({ chapters, tallyOf, visitedIds }: Params): boolean =>
  chapters.length > 0 &&
  chapters.every((chapter) => {
    const tally = tallyOf({ chapter });
    if (tally.total === 0) {
      return visitedIds.includes(chapter.id);
    }
    return tally.tried >= tally.total;
  });

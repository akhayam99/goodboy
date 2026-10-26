import type { DemoChapter } from '../demoChapters';

type Params = {
  readonly chapter: DemoChapter;
  readonly beatIndex: number;
  readonly hintInstruction: string | undefined;
  readonly isGroupDone: boolean;
  readonly next: DemoChapter | undefined;
};

export const headerInstruction = ({
  chapter,
  beatIndex,
  hintInstruction,
  isGroupDone,
  next,
}: Params): string => {
  if (isGroupDone) {
    return next === undefined
      ? `${chapter.title} is done. That was every group.`
      : `${chapter.title} is done. Go on with ${next.title}, marked Up next on the left.`;
  }
  if (hintInstruction !== undefined) {
    return hintInstruction;
  }
  return chapter.beats[beatIndex]?.shows ?? chapter.title;
};

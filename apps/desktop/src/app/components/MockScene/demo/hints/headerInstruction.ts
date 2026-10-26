import type { DemoChapter } from '../demoChapters';

type Params = {
  readonly chapter: DemoChapter;
  readonly beatIndex: number;
  readonly hintInstruction: string | undefined;
  readonly isGroupDone: boolean;
  readonly nextTitle: string;
};

export const headerInstruction = ({
  chapter,
  beatIndex,
  hintInstruction,
  isGroupDone,
  nextTitle,
}: Params): string => {
  if (isGroupDone) {
    return `${chapter.title} is done. Go on with ${nextTitle}, marked Up next.`;
  }
  if (hintInstruction !== undefined) {
    return hintInstruction;
  }
  return chapter.beats[beatIndex]?.shows ?? chapter.title;
};

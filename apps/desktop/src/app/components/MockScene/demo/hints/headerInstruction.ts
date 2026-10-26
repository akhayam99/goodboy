import type { DemoChapter } from '../demoChapters';
import type { DemoHint } from './demoHintTypes';

type Params = {
  readonly chapter: DemoChapter;
  readonly held: DemoHint | undefined;
  readonly active: DemoHint | undefined;
  readonly nextTitle: string;
};

export const headerInstruction = ({ chapter, held, active, nextTitle }: Params): string => {
  if (held !== undefined) {
    return held.result;
  }
  if (active === undefined) {
    return `${chapter.title} is done. Go on with ${nextTitle}, marked Up next.`;
  }
  return active.instruction;
};

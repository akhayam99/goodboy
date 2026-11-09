import type { DemoChapter } from '../demoChapters';
import type { DemoHint } from './demoHintTypes';

type Params = {
  readonly chapter: DemoChapter;
  readonly held: DemoHint | undefined;
  readonly acting: DemoHint | undefined;
  readonly active: DemoHint | undefined;
  readonly nextTitle: string;
  readonly isNextUpNext: boolean;
};

export const headerInstruction = ({
  chapter,
  held,
  acting,
  active,
  nextTitle,
  isNextUpNext,
}: Params): string => {
  if (held !== undefined) {
    return held.result;
  }
  if (active === undefined) {
    const marker = isNextUpNext ? ', marked Up next' : '';
    return `${chapter.title} is done. Go on with ${nextTitle}${marker}.`;
  }
  return acting?.progress ?? active.instruction;
};

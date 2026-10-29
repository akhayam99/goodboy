import { workingPhraseOf } from '../../live-state/workingPhraseOf';
import { lastToolOf } from './lastToolOf';
import type { TranscriptItem } from './transcript-items';

export const THINKING_PHRASE = 'Thinking';

export const WRITING_PHRASE = 'Writing the answer';

type Params = {
  readonly lastItem: TranscriptItem | undefined;
  readonly project: string | null;
};

export const livePhraseOf = ({ lastItem, project }: Params): string => {
  const tool = lastToolOf({ lastItem });
  if (tool !== null) {
    return workingPhraseOf({ tool, project });
  }
  if (lastItem?.kind === 'assistant_text') {
    return WRITING_PHRASE;
  }
  return THINKING_PHRASE;
};

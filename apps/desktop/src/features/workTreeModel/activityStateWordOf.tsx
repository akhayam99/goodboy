import type { ReactNode } from 'react';
import type { ActivityRowTone } from '@goodboy/ui';
import { ACTIVITY_STATE_WORD_TONE } from './activityStateWordTone';

type Params = {
  readonly tone: ActivityRowTone;
  readonly word: string;
};

export const activityStateWordOf = ({ tone, word }: Params): ReactNode => {
  const toneClass = ACTIVITY_STATE_WORD_TONE[tone];
  if (toneClass === null) {
    return null;
  }
  return <span className={toneClass}>{word}</span>;
};

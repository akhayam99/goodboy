import type { WaitWords } from './leadWaitWordsOf';

type Params = {
  readonly suggestion: string | null;
};

export const holdWaitWords = ({ suggestion }: Params): WaitWords => ({
  words: 'Stopped on a check',
  verb: suggestion === null ? 'Open the Lead' : `Switch to ${suggestion}`,
});

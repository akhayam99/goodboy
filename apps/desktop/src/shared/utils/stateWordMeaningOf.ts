import { STATE_WORD_MEANINGS } from './stateWordMeanings';

type Params = {
  readonly word: string;
};

export const stateWordMeaningOf = ({ word }: Params): string | null =>
  STATE_WORD_MEANINGS.find((entry) => entry.word === word)?.meaning ?? null;

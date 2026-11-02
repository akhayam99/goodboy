import type { ResolveWord } from './commentProjection';

type WordParams = {
  readonly word: ResolveWord;
};

export const isSettledWord = ({ word }: WordParams): boolean =>
  word === 'done' || word === 'replied';

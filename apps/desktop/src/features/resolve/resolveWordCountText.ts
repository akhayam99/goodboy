import { countNoun } from '../../shared/utils/countNoun';
import { RESOLVE_WORD_LABEL, type ResolveWord } from './commentProjection';
import { fixesReadyText } from './fixRunReadyCopy';

type Params = {
  readonly word: ResolveWord;
  readonly count: number;
};

export const resolveWordCountText = ({ word, count }: Params): string => {
  if (word === 'to_review') {
    return fixesReadyText({ count });
  }
  if (word === 'question') {
    return countNoun({ count, one: 'question', many: 'questions' });
  }
  return `${count} ${RESOLVE_WORD_LABEL[word].toLowerCase()}`;
};

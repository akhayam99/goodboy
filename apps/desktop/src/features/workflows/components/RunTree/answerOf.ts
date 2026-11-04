import type { OpenQuestion } from '@goodboy/types';
import type { RowAsk } from '../../../workTreeModel/rowState';

type Params = {
  readonly ask: RowAsk | null;
};

export const answerOf = ({ ask }: Params): { readonly question: OpenQuestion | null } | null => {
  if (ask == null) {
    return null;
  }
  switch (ask.kind) {
    case 'answer':
      return { question: ask.question };
    case 'restartStep':
    case 'runStep':
    case 'continue':
    case 'reviewComment':
    case 'groupChild':
      return null;
    default: {
      const exhaustive: never = ask;
      return exhaustive;
    }
  }
};

import type { Tone } from '@goodboy/ui';
import { BRANCH_STATE_TONE } from '../branches/branchStateTone';
import type { BoardRow } from './boardTypes';

type Params = {
  readonly row: Pick<BoardRow, 'isMerged' | 'isClosed'>;
};

type SettledWord = Readonly<{
  word: string;
  tone: Tone;
}>;

export const boardSettledWordOf = ({ row }: Params): SettledWord | null => {
  if (row.isClosed) {
    return { word: 'Closed', tone: BRANCH_STATE_TONE.closed };
  }
  if (row.isMerged) {
    return { word: 'Merged', tone: BRANCH_STATE_TONE.merged };
  }
  return null;
};

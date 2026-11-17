import { ITEM_WORK_WORDS } from '../../live-state/itemWork/itemWorkWords';
import type { BranchCheckWork } from '../hooks/useBranchCheckStep';

type Params = {
  readonly work: BranchCheckWork;
};

export const checkTabLiveOf = ({ work }: Params): string | null => {
  if (work.agentId === null) {
    return null;
  }
  const word = ITEM_WORK_WORDS.state[work.chain === 'fixing' ? 'fixing' : 'analyzing'].word;
  return `${word} ${work.checkName ?? 'the failing check'}`;
};

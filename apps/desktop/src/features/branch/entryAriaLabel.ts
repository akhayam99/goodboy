import type { BranchTab } from '../../store/slices/navigation/types';
import type { WorktreeEntryFacts } from './worktreeEntryFacts';

type Params = {
  readonly label: string;
  readonly fact: WorktreeEntryFacts[BranchTab];
};

export const entryAriaLabel = ({ label, fact }: Params): string => {
  const word = fact.tooltip ?? fact.text;
  return word === null ? label : `${label}, ${word}`;
};

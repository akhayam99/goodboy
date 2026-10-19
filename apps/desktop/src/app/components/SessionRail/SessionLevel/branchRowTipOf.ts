import type { BranchRowFacts } from '../../../../features/branch/branchRowFactsOf';
import type { BranchRowChip } from './branchRowChipOf';

type Params = {
  readonly facts: BranchRowFacts;
  readonly chip: BranchRowChip | null;
  readonly reason: string | null;
};

export type BranchRowTip = {
  readonly summary: string | null;
  readonly branch: string;
  readonly reason: string | null;
};

export const branchRowTipOf = ({ facts, chip, reason }: Params): BranchRowTip => {
  const lead = [facts.number, facts.stateWord].filter((part) => part !== null).join(' ');
  const summary = [lead === '' ? null : lead, chip === null ? null : chip.text]
    .filter((part) => part !== null)
    .join(', ');
  return {
    summary: summary === '' ? null : summary,
    branch: facts.branch,
    reason: chip?.reason ?? reason,
  };
};

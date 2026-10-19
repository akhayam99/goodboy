import { joinFacts } from '../../../../shared/utils/joinFacts';

type Params = {
  readonly behind: number | null;
  readonly conflicts: number | null;
  readonly isRebasing: boolean;
  readonly progress: string | null;
  readonly baseBranch: string | null;
};

export const branchStatusFactsOf = ({
  behind,
  conflicts,
  isRebasing,
  progress,
  baseBranch,
}: Params): string | null => {
  const base = baseBranch ?? 'main';
  const text = joinFacts({
    facts: [
      isRebasing ? 'Rebasing' : null,
      isRebasing ? progress : null,
      !isRebasing && behind !== null && behind > 0 ? `${behind} behind ${base}` : null,
      conflicts !== null && conflicts > 0
        ? `${conflicts} ${conflicts === 1 ? 'conflict' : 'conflicts'}`
        : null,
    ],
  });
  return text === '' ? null : text;
};

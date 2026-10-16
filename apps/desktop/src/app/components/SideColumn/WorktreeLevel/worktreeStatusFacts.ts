type Params = {
  readonly behind: number | null;
  readonly conflicts: number | null;
  readonly isRebasing: boolean;
  readonly baseBranch: string | null;
};

export const worktreeStatusFactsOf = ({
  behind,
  conflicts,
  isRebasing,
  baseBranch,
}: Params): string | null => {
  const base = baseBranch ?? 'main';
  const parts = [
    ...(isRebasing ? [`Rebasing on ${base}`] : []),
    ...(!isRebasing && behind !== null && behind > 0 ? [`${behind} behind ${base}`] : []),
    ...(conflicts !== null && conflicts > 0
      ? [`${conflicts} ${conflicts === 1 ? 'conflict' : 'conflicts'}`]
      : []),
  ];
  return parts.length === 0 ? null : parts.join(' · ');
};

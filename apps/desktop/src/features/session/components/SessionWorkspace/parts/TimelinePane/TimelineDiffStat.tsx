type Props = {
  readonly additions: number;
  readonly deletions: number;
};

export const TimelineDiffStat = ({ additions, deletions }: Props) => {
  if (additions === 0 && deletions === 0) {
    return null;
  }
  return (
    <span
      data-testid="timeline-diff-stat"
      className="flex shrink-0 items-center gap-1 text-3xs tabular-nums"
    >
      {additions === 0 ? null : <span className="text-success/80">{`+${additions}`}</span>}
      {deletions === 0 ? null : <span className="text-danger/80">{`-${deletions}`}</span>}
    </span>
  );
};

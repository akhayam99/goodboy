type Props = {
  readonly additions: number;
  readonly deletions: number;
};

export const Delta = ({ additions, deletions }: Props) => (
  <span className="flex shrink-0 gap-1 text-meta tabular-nums">
    <span className="text-success">+{additions}</span>
    <span className="text-danger">−{deletions}</span>
  </span>
);

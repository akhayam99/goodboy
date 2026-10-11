type Props = {
  readonly count: number;
};

export const GroupCount = ({ count }: Props) => (
  <span className="tabular-nums text-meta text-faint-foreground">{count}</span>
);

type Props = {
  readonly count: number;
};

export const FilterCount = ({ count }: Props) => (
  <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{count}</span>
);

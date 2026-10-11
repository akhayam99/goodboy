type Props = {
  readonly count: number | null;
};

export const TabCount = ({ count }: Props) =>
  count === null ? (
    <span role="img" aria-label="Not loaded" className="text-faint-foreground">
      -
    </span>
  ) : (
    <span className="tabular-nums text-faint-foreground">{count}</span>
  );

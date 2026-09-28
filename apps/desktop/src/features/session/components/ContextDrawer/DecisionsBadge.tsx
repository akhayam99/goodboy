type Props = {
  readonly count: number;
  readonly hasChanges: boolean;
};

export const DecisionsBadge = ({ count, hasChanges }: Props) => (
  <span className="inline-flex items-center gap-1">
    {count > 0 ? <span className="tabular-nums text-faint-foreground">{count}</span> : null}
    {hasChanges ? (
      <span
        role="img"
        aria-label="Changed since you last looked"
        className="size-1.5 rounded-full bg-primary"
      />
    ) : null}
  </span>
);

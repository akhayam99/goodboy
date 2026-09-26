type Props = {
  readonly count: number;
  readonly newCount: number;
};

export const DecisionsBadge = ({ count, newCount }: Props) => (
  <span className="inline-flex items-center gap-1">
    {count > 0 ? <span className="tabular-nums text-faint-foreground">{count}</span> : null}
    {newCount > 0 ? (
      <span
        role="img"
        aria-label={`${newCount} new since you last looked`}
        title={`${newCount} new since you last looked`}
        className="size-1.5 rounded-full bg-primary"
      />
    ) : null}
  </span>
);

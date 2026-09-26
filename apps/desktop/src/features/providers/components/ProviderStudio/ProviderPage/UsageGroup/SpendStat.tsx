type Props = {
  readonly label: string;
  readonly value: string;
};

export const SpendStat = ({ label, value }: Props) => (
  <span className="flex items-baseline gap-1">
    <span className="text-muted-foreground">{label}</span>
    <span className="tabular-nums text-foreground">{value}</span>
  </span>
);

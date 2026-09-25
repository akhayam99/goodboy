type Props = {
  readonly label: string;
  readonly value: string;
};

export const SpendStat = ({ label, value }: Props) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-2xs text-faint-foreground">{label}</span>
    <span className="text-sm font-medium tabular-nums text-foreground">{value}</span>
  </div>
);

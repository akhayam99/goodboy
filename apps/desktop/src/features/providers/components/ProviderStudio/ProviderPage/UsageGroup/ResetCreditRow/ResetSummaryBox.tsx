type Props = {
  readonly label: string;
  readonly value: string;
};

export const ResetSummaryBox = ({ label, value }: Props) => (
  <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm bg-fill px-3 py-2">
    <span className="text-meta text-muted-foreground">{label}</span>
    <span className="truncate text-label tabular-nums text-foreground">{value}</span>
  </div>
);

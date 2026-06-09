type Props = {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
};

export function StatCard({ label, value, hint }: Props) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border-soft bg-muted/20 px-4 py-3">
      <span className="text-2xs uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className="font-mono text-xl tabular-nums text-foreground">{value}</span>
      {hint ? <span className="text-2xs text-muted-foreground/70">{hint}</span> : null}
    </div>
  );
}

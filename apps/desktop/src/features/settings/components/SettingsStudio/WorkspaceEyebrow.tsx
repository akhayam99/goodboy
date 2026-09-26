type Props = {
  readonly id: string;
  readonly label: string;
  readonly count?: number;
};

export const WorkspaceEyebrow = ({ id, label, count }: Props) => (
  <h2 id={id} className="flex items-center gap-1.5 text-eyebrow text-muted-foreground">
    {label}
    {count === undefined ? null : <span className="tabular-nums text-foreground">{count}</span>}
  </h2>
);

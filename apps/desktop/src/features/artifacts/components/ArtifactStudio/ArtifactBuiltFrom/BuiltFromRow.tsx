type Props = {
  readonly label: string;
  readonly children: string;
};

export const BuiltFromRow = ({ label, children }: Props) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="min-w-0 whitespace-pre-wrap break-words text-xs text-foreground">
      {children}
    </span>
  </div>
);

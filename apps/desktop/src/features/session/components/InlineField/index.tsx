type Props = {
  label: string;
  children: React.ReactNode;
};

export const InlineField = ({ label, children }: Props) => {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      {children}
    </div>
  );
};

type Props = {
  readonly label: string;
};

export const QuietSessionLine = ({ label }: Props) => (
  <span className="truncate text-meta text-faint-foreground">{label}</span>
);

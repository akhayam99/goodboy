type Props = {
  readonly label: string;
};

export const QuietSessionCells = ({ label }: Props) => (
  <>
    <span data-cell="session" className="truncate text-label text-faint-foreground">
      {label}
    </span>
    <span data-cell="state" />
  </>
);

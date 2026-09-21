type Props = {
  readonly path: string;
  readonly line: number | null;
  readonly onOpen: () => void;
};

export const ThreadPathChip = ({ path, line, onOpen }: Props) => {
  const suffix = line != null ? `:${line}` : '';
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${path}${suffix}`}
      className="block w-fit max-w-full truncate rounded bg-background/60 px-1.5 py-0.5 text-left font-mono text-2xs text-muted-foreground hover:text-foreground"
    >
      {path}
      {suffix}
    </button>
  );
};

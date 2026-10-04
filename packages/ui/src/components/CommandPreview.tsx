type Props = {
  readonly command: string;
};

export const CommandPreview = ({ command }: Props) => {
  return (
    <div className="overflow-x-auto rounded-md bg-subtle px-3 py-1 font-mono text-chip text-muted-foreground">
      <span aria-hidden className="text-faint-foreground">
        ${' '}
      </span>
      <span className="text-foreground">{command}</span>
    </div>
  );
};

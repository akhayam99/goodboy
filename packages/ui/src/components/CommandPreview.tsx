type Props = {
  readonly command: string;
};

export const CommandPreview = ({ command }: Props) => {
  return (
    <div className="overflow-x-auto rounded-md bg-subtle px-2.5 py-1.5 font-mono text-secondary text-muted-foreground">
      <span aria-hidden className="text-faint-foreground">
        ${' '}
      </span>
      <span className="text-foreground">{command}</span>
    </div>
  );
};

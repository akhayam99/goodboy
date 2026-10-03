type Props = {
  readonly name: string;
};

export const ToolMark = ({ name }: Props) => (
  <span
    aria-hidden
    className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-fill font-mono text-meta text-muted-foreground"
  >
    {name.slice(0, 2)}
  </span>
);

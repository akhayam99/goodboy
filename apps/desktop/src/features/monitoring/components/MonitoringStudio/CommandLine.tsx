type Props = {
  readonly args: string;
};

export const CommandLine = ({ args }: Props) => (
  <div role="group" aria-label="Command line" className="relative z-10 col-[2/-1] min-w-0 pb-1">
    <code className="block break-all font-mono text-meta text-muted-foreground">
      {args === '' ? 'No arguments' : args}
    </code>
  </div>
);

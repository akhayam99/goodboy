type Props = {
  readonly args: string;
};

export const CommandLine = ({ args }: Props) => (
  <div role="group" aria-label="Command line" className="min-w-0 px-2 pb-1 pl-9">
    <code className="block break-all font-mono text-meta text-muted-foreground">
      {args === '' ? 'No arguments' : args}
    </code>
  </div>
);

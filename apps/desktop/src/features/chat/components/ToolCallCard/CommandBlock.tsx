type Props = {
  readonly command: string;
};

export const CommandBlock = ({ command }: Props) => (
  <pre
    data-testid="tool-command"
    className="min-w-0 whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 text-code text-foreground"
  >
    <span aria-hidden className="select-none text-faint-foreground">
      ${' '}
    </span>
    {command}
  </pre>
);

type Props = {
  readonly text: string;
};

export const HandoffRawText = ({ text }: Props) => (
  <pre className="whitespace-pre-wrap break-words font-mono text-2xs leading-relaxed text-muted-foreground">
    {text}
  </pre>
);

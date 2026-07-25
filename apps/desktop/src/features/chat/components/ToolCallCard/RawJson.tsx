type Props = {
  readonly data: unknown;
};

export const RawJson = ({ data }: Props) => (
  <pre className="whitespace-pre-wrap break-words text-muted-foreground">
    {JSON.stringify(data, null, 2)}
  </pre>
);

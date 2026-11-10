type Props = {
  readonly count: number;
  readonly limit: number;
  readonly noun: string;
};

export const ComposerAttachmentCount = ({ count, limit, noun }: Props) => {
  if (count === 0) {
    return null;
  }
  return (
    <span className="shrink-0 whitespace-nowrap text-meta tabular-nums text-faint-foreground">
      {`${count} of ${limit} ${noun}`}
    </span>
  );
};

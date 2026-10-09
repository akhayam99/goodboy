type Props = {
  readonly value: string;
  readonly tail: RegExp;
};

export const MiddleText = ({ value, tail }: Props) => {
  const at = value.search(tail);
  if (at <= 0) {
    return <span className="truncate">{value}</span>;
  }
  return (
    <span className="flex min-w-0 max-w-full">
      <span className="sr-only">{value}</span>
      <span aria-hidden className="truncate">
        {value.slice(0, at)}
      </span>
      <span aria-hidden className="shrink-0">
        {value.slice(at)}
      </span>
    </span>
  );
};

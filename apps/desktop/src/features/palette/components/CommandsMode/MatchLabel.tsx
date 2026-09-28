type Props = {
  readonly label: string;
  readonly positions: ReadonlyArray<number>;
};

type Segment = {
  readonly text: string;
  readonly isMatch: boolean;
};

const segmentsOf = ({ label, positions }: Props): ReadonlyArray<Segment> => {
  const marked = new Set(positions);
  const segments: Array<Segment> = [];
  for (let index = 0; index < label.length; index += 1) {
    const isMatch = marked.has(index);
    const char = label[index] ?? '';
    const last = segments[segments.length - 1];
    if (last !== undefined && last.isMatch === isMatch) {
      segments[segments.length - 1] = { text: `${last.text}${char}`, isMatch };
      continue;
    }
    segments.push({ text: char, isMatch });
  }
  return segments;
};

export const MatchLabel = ({ label, positions }: Props) => {
  if (positions.length === 0) {
    return <span className="max-w-full shrink-0 truncate">{label}</span>;
  }
  return (
    <span className="max-w-full shrink-0 truncate">
      <span className="sr-only">{label}</span>
      <span aria-hidden>
        {segmentsOf({ label, positions }).map((segment, index) =>
          segment.isMatch ? (
            <span key={index} data-match className="text-row text-foreground">
              {segment.text}
            </span>
          ) : (
            <span key={index} className="text-muted-foreground">
              {segment.text}
            </span>
          ),
        )}
      </span>
    </span>
  );
};

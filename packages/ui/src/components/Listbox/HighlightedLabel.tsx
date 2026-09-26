import type { ListboxMatch } from './filterOptions';

type Props = {
  readonly label: string;
  readonly match: ListboxMatch;
};

type Segment = {
  readonly text: string;
  readonly isMatch: boolean;
};

const segmentsOf = ({ label, match }: Props): ReadonlyArray<Segment> => {
  const marked = new Set(match);
  const segments: Segment[] = [];
  for (const [index, char] of Array.from(label).entries()) {
    const isMatch = marked.has(index);
    const last = segments[segments.length - 1];
    if (last !== undefined && last.isMatch === isMatch) {
      segments[segments.length - 1] = { text: `${last.text}${char}`, isMatch };
      continue;
    }
    segments.push({ text: char, isMatch });
  }
  return segments;
};

export const HighlightedLabel = ({ label, match }: Props) => {
  if (match.length === 0) {
    return <>{label}</>;
  }
  return (
    <>
      {segmentsOf({ label, match }).map((segment, index) =>
        segment.isMatch ? (
          <span key={index} data-match className="underline underline-offset-2">
            {segment.text}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
};

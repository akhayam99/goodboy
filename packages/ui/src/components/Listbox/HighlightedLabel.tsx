import type { ListboxMatch } from './filterOptions';

type Props = {
  readonly label: string;
  readonly match: ListboxMatch;
};

type Segment = {
  readonly text: string;
  readonly isMatch: boolean;
};

type MarkedProps = {
  readonly chars: ReadonlyArray<string>;
  readonly match: ListboxMatch;
  readonly offset: number;
};

const segmentsOf = ({ chars, match, offset }: MarkedProps): ReadonlyArray<Segment> => {
  const marked = new Set(match);
  const segments: Segment[] = [];
  for (const [index, char] of chars.entries()) {
    const isMatch = marked.has(index + offset);
    const last = segments[segments.length - 1];
    if (last !== undefined && last.isMatch === isMatch) {
      segments[segments.length - 1] = { text: `${last.text}${char}`, isMatch };
      continue;
    }
    segments.push({ text: char, isMatch });
  }
  return segments;
};

const markedNodes = ({ chars, match, offset }: MarkedProps) =>
  segmentsOf({ chars, match, offset }).map((segment, index) =>
    segment.isMatch ? (
      <span key={index} data-match className="underline underline-offset-2">
        {segment.text}
      </span>
    ) : (
      <span key={index}>{segment.text}</span>
    ),
  );

export const HighlightedLabel = ({ label, match }: Props) => {
  const chars = Array.from(label);
  if (match.length === 0) {
    return <>{label}</>;
  }
  return (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden>{markedNodes({ chars, match, offset: 0 })}</span>
    </>
  );
};

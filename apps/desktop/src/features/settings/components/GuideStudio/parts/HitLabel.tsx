type Props = {
  readonly text: string;
  readonly words: ReadonlyArray<string>;
};

type Span = {
  readonly start: number;
  readonly end: number;
};

type SpansParams = {
  readonly text: string;
  readonly words: ReadonlyArray<string>;
};

const spansOf = ({ text, words }: SpansParams): ReadonlyArray<Span> => {
  const lower = text.toLowerCase();
  const found = words
    .map((word) => ({ start: lower.indexOf(word), end: lower.indexOf(word) + word.length }))
    .filter((span) => span.start >= 0)
    .sort((a, b) => a.start - b.start);
  return found.reduce<ReadonlyArray<Span>>((kept, span) => {
    const last = kept[kept.length - 1];
    if (last !== undefined && span.start < last.end) {
      return [...kept.slice(0, -1), { start: last.start, end: Math.max(last.end, span.end) }];
    }
    return [...kept, span];
  }, []);
};

export const HitLabel = ({ text, words }: Props) => {
  const spans = spansOf({ text, words });
  if (spans.length === 0) {
    return <>{text}</>;
  }
  const pieces = spans.flatMap((span, index) => {
    const from = index === 0 ? 0 : (spans[index - 1]?.end ?? 0);
    return [
      <span key={`t${span.start}`}>{text.slice(from, span.start)}</span>,
      <mark key={`m${span.start}`} className="rounded-sm bg-find-match text-foreground">
        {text.slice(span.start, span.end)}
      </mark>,
    ];
  });
  const tail = text.slice(spans[spans.length - 1]?.end ?? 0);
  return (
    <>
      {pieces}
      <span>{tail}</span>
    </>
  );
};

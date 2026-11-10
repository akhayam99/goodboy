export const TEXT_SENTENCE_MS = 600;

type Params = {
  readonly atMs: number;
  readonly text: string;
  readonly maxSpanMs?: number;
};

export const textCuesEndMs = ({ atMs, text, maxSpanMs }: Params): number => {
  const span = text.split('. ').length * TEXT_SENTENCE_MS;
  return atMs + (maxSpanMs === undefined ? span : Math.min(span, maxSpanMs));
};

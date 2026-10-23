export const TEXT_SENTENCE_MS = 900;

type Params = {
  readonly atMs: number;
  readonly text: string;
};

export const textCuesEndMs = ({ atMs, text }: Params): number =>
  atMs + text.split('. ').length * TEXT_SENTENCE_MS;

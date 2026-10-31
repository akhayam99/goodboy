const HINT_INLINE_CHARS = 60;

type Params = {
  readonly text: string;
};

export const hintIsLong = ({ text }: Params): boolean => {
  const trimmed = text.trim();
  return trimmed.includes('\n') || trimmed.length > HINT_INLINE_CHARS;
};

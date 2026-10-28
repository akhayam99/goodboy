const QUOTES: ReadonlySet<string> = new Set(['"', "'", '`', '“', '”', '‘', '’']);

type TextParams = {
  readonly text: string;
};

export const stripWrappingQuotes = ({ text }: TextParams): string => {
  let start = 0;
  while (start < text.length && QUOTES.has(text.charAt(start))) {
    start += 1;
  }
  let end = text.length;
  while (end > start && QUOTES.has(text.charAt(end - 1))) {
    end -= 1;
  }
  return text.slice(start, end);
};

const PUNCTUATION: ReadonlySet<string> = new Set(['.', ',', ';', ':', '!', '?']);

type TextParams = {
  readonly text: string;
};

export const stripTrailingPunctuation = ({ text }: TextParams): string => {
  let end = text.length;
  while (end > 0 && PUNCTUATION.has(text.charAt(end - 1))) {
    end -= 1;
  }
  return text.slice(0, end);
};

type Params = {
  readonly tokens: ReadonlyArray<string>;
  readonly index: number;
};

const TRAILING_MARKS: ReadonlySet<string> = new Set([',', ';', '!', '?']);

export const wordOf = ({ tokens, index }: Params): string => {
  const word = (tokens[index] ?? '').toLowerCase();
  let end = word.length;
  while (end > 0 && TRAILING_MARKS.has(word.charAt(end - 1))) {
    end -= 1;
  }
  return word.slice(0, end);
};

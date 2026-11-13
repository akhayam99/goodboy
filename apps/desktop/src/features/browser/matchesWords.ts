type Params = {
  readonly words: ReadonlyArray<string>;
  readonly fields: ReadonlyArray<string>;
};

export const matchesWords = ({ words, fields }: Params): boolean => {
  const haystack = fields.join(' ').toLowerCase();
  return words.every((word) => haystack.includes(word));
};

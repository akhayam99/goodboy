type Params = {
  readonly nouns: ReadonlyArray<string>;
};

export const joinNouns = ({ nouns }: Params): string =>
  nouns.length <= 1
    ? (nouns[0] ?? '')
    : `${nouns.slice(0, -1).join(', ')} and ${nouns[nouns.length - 1] ?? ''}`;

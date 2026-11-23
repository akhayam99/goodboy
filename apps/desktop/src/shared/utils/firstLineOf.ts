type Params = {
  readonly text: string;
};

export const firstLineOf = ({ text }: Params): string | null =>
  text
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part !== '') ?? null;

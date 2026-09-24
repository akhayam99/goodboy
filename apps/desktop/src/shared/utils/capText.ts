type Params = {
  readonly text: string;
  readonly capChars: number;
};

export const capText = ({ text, capChars }: Params): string =>
  text.length > capChars ? `${text.slice(0, capChars).trimEnd()}…` : text;

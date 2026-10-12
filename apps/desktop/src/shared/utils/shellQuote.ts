type Params = {
  readonly value: string;
};

export const shellQuote = ({ value }: Params): string => `'${value.replaceAll("'", "'\\''")}'`;

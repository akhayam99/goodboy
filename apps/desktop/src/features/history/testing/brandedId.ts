type Params = {
  readonly value: string;
};

export const brandedId = <Id extends string>({ value }: Params): Id =>
  JSON.parse(JSON.stringify(value));

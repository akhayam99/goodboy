type Params = Readonly<{
  indexes: ReadonlyArray<number>;
}>;

const LIST = new Intl.ListFormat('en', { type: 'conjunction' });

export const partNumbers = ({ indexes }: Params): string => {
  const numbers = LIST.format(indexes.map((index) => String(index + 1)));
  return indexes.length === 1 ? `part ${numbers}` : `parts ${numbers}`;
};

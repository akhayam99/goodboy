type Params = Readonly<{
  index: number;
  size: number;
}>;

export const waveLabel = ({ index, size }: Params): string => {
  const lead = index === 0 ? 'Runs first' : 'Then';
  return size > 1 ? `${lead}, in parallel` : lead;
};

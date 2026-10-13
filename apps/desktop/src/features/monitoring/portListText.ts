type Params = {
  readonly ports: ReadonlyArray<number>;
  readonly max: number;
};

export const portListText = ({ ports, max }: Params): string => {
  const unique = [...new Set(ports)].sort((a, b) => a - b);
  const shown = unique.slice(0, max).map((port) => `:${port}`);
  const hidden = unique.length - shown.length;
  return hidden > 0 ? `${shown.join(' ')} +${hidden}` : shown.join(' ');
};

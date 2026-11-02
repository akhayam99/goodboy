type Params = {
  readonly args: Readonly<Record<string, unknown>>;
  readonly key: string;
};

export const bridgeText = ({ args, key }: Params): string => {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
};

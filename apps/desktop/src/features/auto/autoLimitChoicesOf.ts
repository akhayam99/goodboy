type Params = {
  readonly usd: number | null;
  readonly defaultUsd: number | null;
};

const PRESET_USD = [5, 10, 25] as const;

export const autoLimitChoicesOf = ({ usd, defaultUsd }: Params): ReadonlyArray<number> => {
  const amounts = [...PRESET_USD, defaultUsd, usd].filter(
    (amount): amount is number => amount !== null,
  );
  return [...new Set(amounts)].sort((left, right) => left - right);
};

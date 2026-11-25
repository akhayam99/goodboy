import { MAX_RAISED_LIMIT_USD } from './actionLimits';

const PRESET_USD = [5, 10, 25] as const;

type AmountsParams = {
  readonly defaultUsd: number | null;
};

export const startLimitAmountsOf = ({ defaultUsd }: AmountsParams): ReadonlyArray<number> => {
  const amounts = [...PRESET_USD, ...(defaultUsd === null ? [] : [defaultUsd])].filter(
    (amount) => amount > 0 && amount <= MAX_RAISED_LIMIT_USD,
  );
  return [...new Set(amounts)].sort((left, right) => left - right);
};

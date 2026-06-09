export const formatUsd = (usd: number): string => {
  if (usd === 0) {
    return '$0';
  }
  if (usd < 0.01) {
    return '<$0.01';
  }
  if (usd < 1) {
    return `$${usd.toFixed(3)}`;
  }
  return `$${usd.toFixed(2)}`;
};

export const formatUsdPrecise = (usd: number): string => {
  return `$${usd.toFixed(4)}`;
};

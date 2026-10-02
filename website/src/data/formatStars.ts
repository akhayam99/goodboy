const STEP = 100;
const THOUSAND = 1000;

export const formatStars = (count: number): string | null => {
  if (!Number.isFinite(count) || count < STEP) {
    return null;
  }
  const floored = Math.floor(count / STEP) * STEP;
  if (floored < THOUSAND) {
    return `${floored}+`;
  }
  const thousands = (floored / THOUSAND).toFixed(1).replace(/\.0$/, '');
  return `${thousands}k+`;
};

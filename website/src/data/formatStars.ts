const STEP = 100;
const THOUSAND = 1000;

type Params = {
  readonly count: number | null;
};

const formatStars = ({ count }: Params): string | null => {
  if (count === null || !Number.isFinite(count) || count < STEP) {
    return null;
  }
  const floored = Math.floor(count / STEP) * STEP;
  if (floored < THOUSAND) {
    return `${floored}+`;
  }
  const thousands = (floored / THOUSAND).toFixed(1).replace(/\.0$/, '');
  return `${thousands}k+`;
};

export const STARS = formatStars({ count: __GOODBOY_STARS__ });

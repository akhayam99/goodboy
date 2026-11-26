import type { StartLimit } from '../../auto/startLimitOf';

type Params = {
  readonly limitUsd: number | null;
  readonly defaultUsd: number | null;
};

export const phoneStartLimitOf = ({ limitUsd, defaultUsd }: Params): StartLimit => {
  const usd = limitUsd ?? defaultUsd;
  if (usd === null) {
    return { usd: null, source: null };
  }
  return { usd, source: usd === defaultUsd ? 'default' : 'run' };
};

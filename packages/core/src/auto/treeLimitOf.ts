import { AUTO_DEFAULT_TREE_CAP_USD } from './limits';

type AutoTreeLimitSource = 'session' | 'workspace' | 'default';

type AutoTreeLimit = Readonly<{
  usd: number;
  source: AutoTreeLimitSource;
}>;

type Params = {
  readonly sessionCapUsd: number | null;
  readonly workspaceLimitUsd: number | null;
};

const isUsable = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value > 0;

export const autoTreeLimitOf = ({ sessionCapUsd, workspaceLimitUsd }: Params): AutoTreeLimit => {
  const auto: AutoTreeLimit = isUsable(workspaceLimitUsd)
    ? { usd: workspaceLimitUsd, source: 'workspace' }
    : { usd: AUTO_DEFAULT_TREE_CAP_USD, source: 'default' };
  if (isUsable(sessionCapUsd) && sessionCapUsd < auto.usd) {
    return { usd: sessionCapUsd, source: 'session' };
  }
  return auto;
};

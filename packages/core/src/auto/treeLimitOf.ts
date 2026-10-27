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

type UsableParams = {
  readonly value: number | null;
};

const usableUsdOf = ({ value }: UsableParams): number | null =>
  value !== null && Number.isFinite(value) && value > 0 ? value : null;

export const autoTreeLimitOf = ({ sessionCapUsd, workspaceLimitUsd }: Params): AutoTreeLimit => {
  const workspaceUsd = usableUsdOf({ value: workspaceLimitUsd });
  const sessionUsd = usableUsdOf({ value: sessionCapUsd });
  const auto: AutoTreeLimit =
    workspaceUsd === null
      ? { usd: AUTO_DEFAULT_TREE_CAP_USD, source: 'default' }
      : { usd: workspaceUsd, source: 'workspace' };
  if (sessionUsd !== null && sessionUsd < auto.usd) {
    return { usd: sessionUsd, source: 'session' };
  }
  return auto;
};

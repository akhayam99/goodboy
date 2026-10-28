type AutoTreeLimitSource = 'session' | 'workspace' | 'none';

type AutoTreeLimit = Readonly<{
  usd: number | null;
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
  if (sessionUsd !== null && (workspaceUsd === null || sessionUsd < workspaceUsd)) {
    return { usd: sessionUsd, source: 'session' };
  }
  if (workspaceUsd === null) {
    return { usd: null, source: 'none' };
  }
  return { usd: workspaceUsd, source: 'workspace' };
};

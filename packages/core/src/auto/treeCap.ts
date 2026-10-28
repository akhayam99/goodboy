import { autoTreeLimitOf } from './treeLimitOf';

export type AutoTreeCapParams = Readonly<{
  sessionCapUsd: number | null;
  workspaceLimitUsd: number | null;
}>;

export const autoTreeCapUsd = ({
  sessionCapUsd,
  workspaceLimitUsd,
}: AutoTreeCapParams): number | null => autoTreeLimitOf({ sessionCapUsd, workspaceLimitUsd }).usd;

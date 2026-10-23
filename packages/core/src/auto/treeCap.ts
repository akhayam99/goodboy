import { autoTreeLimitOf } from './treeLimitOf';

export type AutoTreeCapParams = Readonly<{
  sessionCapUsd: number | null;
  workspaceLimitUsd: number | null;
}>;

export const autoTreeCapUsd = ({ sessionCapUsd, workspaceLimitUsd }: AutoTreeCapParams): number =>
  autoTreeLimitOf({ sessionCapUsd, workspaceLimitUsd }).usd;

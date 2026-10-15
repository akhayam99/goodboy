import { AUTO_DEFAULT_TREE_CAP_USD } from './limits';

export type AutoTreeCapParams = Readonly<{
  sessionCapUsd: number | null;
  workspaceLimitUsd: number | null;
}>;

const isUsable = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value > 0;

export const autoTreeCapUsd = ({ sessionCapUsd, workspaceLimitUsd }: AutoTreeCapParams): number => {
  if (isUsable(sessionCapUsd)) {
    return sessionCapUsd;
  }
  return isUsable(workspaceLimitUsd) ? workspaceLimitUsd : AUTO_DEFAULT_TREE_CAP_USD;
};

import { formatAge } from '../../shared/utils/time/formatAge';
import type { PortSummary } from './portSummary';

type Params = {
  readonly summary: PortSummary;
  readonly takenAt: number | null;
  readonly now: number;
};

export const summaryMeta = ({ summary, takenAt, now }: Params): string => {
  const counts = `${summary.inUse} of ${summary.total} watched ports in use`;
  if (takenAt === null) {
    return counts;
  }
  return `${counts} · updated ${formatAge({ from: takenAt, now })}`;
};

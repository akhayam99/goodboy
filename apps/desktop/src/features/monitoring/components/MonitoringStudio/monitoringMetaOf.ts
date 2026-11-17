import type { PortSummary } from '../../portSummary';
import { summaryMeta } from '../../summaryMeta';

type Params = {
  readonly isReady: boolean;
  readonly isEmpty: boolean;
  readonly summary: PortSummary;
  readonly takenAt: number | null;
  readonly now: number;
};

export const monitoringMetaOf = ({
  isReady,
  isEmpty,
  summary,
  takenAt,
  now,
}: Params): string | undefined => {
  if (!isReady) {
    return undefined;
  }
  if (isEmpty) {
    return 'Nothing tracked';
  }
  return summaryMeta({ summary, takenAt, now }) ?? undefined;
};

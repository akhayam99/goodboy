import { formatUsd } from '@goodboy/ui';

type Params = {
  readonly rangeLabel: string;
  readonly sessionCount: number | null;
  readonly spentUsd: number;
};

export const impactMeta = ({ rangeLabel, sessionCount, spentUsd }: Params): string => {
  if (sessionCount === null) {
    return rangeLabel;
  }
  const done = `${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'} done`;
  if (sessionCount === 0) {
    return done;
  }
  return `${rangeLabel} · ${done} · ${formatUsd(spentUsd)} spent`;
};

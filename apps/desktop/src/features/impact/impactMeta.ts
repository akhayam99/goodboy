import { formatUsd } from '@goodboy/ui';
import { countNoun } from '../../shared/utils/countNoun';

type Params = {
  readonly rangeLabel: string;
  readonly sessionCount: number | null;
  readonly spentUsd: number;
};

export const impactMeta = ({ rangeLabel, sessionCount, spentUsd }: Params): string => {
  if (sessionCount === null) {
    return rangeLabel;
  }
  const done = `${countNoun({ count: sessionCount, one: 'session' })} done`;
  if (sessionCount === 0) {
    return done;
  }
  return `${rangeLabel} · ${done} · ${formatUsd(spentUsd)} spent`;
};

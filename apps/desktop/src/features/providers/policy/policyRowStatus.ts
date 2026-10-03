import { formatLimitReset } from '../limits/formatLimitReset';
import type { PolicyRow } from './policyRows';

export type PolicyRowStatus = Readonly<{
  text: string;
  limit: string | null;
}>;

type Params = {
  readonly row: PolicyRow;
  readonly nowMs: number;
};

const baseText = ({ row }: Pick<Params, 'row'>): string => {
  if (row.isNew) {
    return 'Connected just now. Not used until you turn it on.';
  }
  if (row.state === 'off') {
    return 'Never used';
  }
  if (row.state === 'backup') {
    return 'Used when no On provider can work';
  }
  return row.isDefault ? 'Default for new work' : 'Used in this order';
};

const limitText = ({ row, nowMs }: Params): string | null => {
  if (row.isNew || row.state === 'off' || !row.isAtLimit) {
    return null;
  }
  if (row.keepAfterLimit) {
    return 'At limit, keeps going';
  }
  const until =
    row.limitResetsAt === null ? '' : formatLimitReset({ iso: row.limitResetsAt, nowMs });
  return until === '' ? 'At limit' : `At limit until ${until}`;
};

export const policyRowStatus = ({ row, nowMs }: Params): PolicyRowStatus => ({
  text: baseText({ row }),
  limit: limitText({ row, nowMs }),
});

import { formatUsd } from '@goodboy/ui';
import { PERMISSION_GRID_CLASS } from './permissionGrid';

type Props = {
  readonly spendLimitUsd: number | null;
};

export const PermissionLimitRow = ({ spendLimitUsd }: Props) => (
  <div data-permission-row="spendLimit" className={PERMISSION_GRID_CLASS}>
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-h-6 items-center text-row text-foreground">Limit</span>
      <span className="text-meta text-muted-foreground">
        Counts the Lead and every agent it starts, and pauses there.
      </span>
    </div>
    <span className="text-row tabular-nums text-foreground">
      {spendLimitUsd === null ? 'Set when it starts' : formatUsd(spendLimitUsd)}
    </span>
  </div>
);

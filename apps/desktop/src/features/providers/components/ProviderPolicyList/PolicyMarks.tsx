import { Checkbox } from '@goodboy/ui';
import type { PolicyRow } from '../../policy/policyRows';

type Props = {
  readonly row: PolicyRow;
  readonly onToggleKeepAfterLimit: () => void;
};

export const PolicyMarks = ({ row, onToggleKeepAfterLimit }: Props) => (
  <div className="flex flex-wrap items-center gap-4 pb-2 pl-12 pr-2">
    <span title="Stays in the order when at its limit.">
      <Checkbox
        label="Keep using after the limit"
        checked={row.keepAfterLimit}
        onChange={onToggleKeepAfterLimit}
      />
    </span>
  </div>
);

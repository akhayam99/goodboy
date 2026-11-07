import { Chip, OptionalTooltip } from '@goodboy/ui';
import { alsoOnLabelOf } from '../utils/alsoOnLabelOf';
import { branchListLabelOf, type AlsoOnBranch } from '../utils/branchListLabelOf';

type Props = {
  readonly branches: ReadonlyArray<AlsoOnBranch>;
  readonly onReveal: () => void;
};

export const AlsoOnChip = ({ branches, onReveal }: Props) => {
  if (branches.length === 0) {
    return null;
  }
  return (
    <OptionalTooltip content={branchListLabelOf({ branches })}>
      <Chip
        as="button"
        tone="neutral"
        kind="id"
        bordered={false}
        emphasis="subtle"
        testId="run-also-on"
        label={<span className="truncate">{alsoOnLabelOf({ branches })}</span>}
        className="min-w-0 shrink-[8]"
        onClick={onReveal}
      />
    </OptionalTooltip>
  );
};

import { Chip } from '@goodboy/ui';
import type { BranchLabel } from './useBranchLabels';

type Props = {
  readonly label: BranchLabel;
};

export const BranchChip = ({ label }: Props) => (
  <Chip
    kind="state"
    tone="neutral"
    label={label.projectName}
    title={label.branch}
    testId="branch-chip"
  />
);

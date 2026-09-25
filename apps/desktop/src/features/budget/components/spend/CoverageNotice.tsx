import { Notice } from '@goodboy/ui';
import type { CoverageTurnCounts } from './lib';

type Props = {
  readonly counts: CoverageTurnCounts;
};

export const CoverageNotice = ({ counts }: Props) => {
  if (counts.unpriced === 0) {
    return null;
  }

  return (
    <Notice
      tone="warning"
      placement="banner"
      title="Some turns have no price"
      body={`No price for ${counts.unpriced} of ${counts.total} turns, so a cap cannot include them`}
    />
  );
};

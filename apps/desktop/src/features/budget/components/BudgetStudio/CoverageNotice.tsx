import { TriangleAlert } from 'lucide-react';
import type { CoverageTurnCounts } from './lib';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly counts: CoverageTurnCounts;
};

export const CoverageNotice = ({ counts }: Props) => {
  if (counts.unpriced === 0) {
    return null;
  }

  return (
    <p className="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
      <TriangleAlert size={ICON_SIZE.control} aria-hidden className="shrink-0 text-warning" />
      <span>
        {`No price for ${counts.unpriced} of ${counts.total} turns, so a cap cannot include them`}
      </span>
    </p>
  );
};

import { ChevronRight } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openGuideChapter } from '../../../settings/openGuideChapter';

export const CostGuideLink = () => (
  <div className="flex">
    <button
      type="button"
      onClick={() => openGuideChapter({ id: 'tokens' })}
      className="flex items-center gap-1 rounded-sm text-label text-foreground underline decoration-border-soft underline-offset-3 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      How cost is counted, in the Guide
      <ChevronRight size={ICON_SIZE.row} aria-hidden />
    </button>
  </div>
);

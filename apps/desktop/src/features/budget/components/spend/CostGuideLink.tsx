import { ChevronRight } from 'lucide-react';
import { ICON_SIZE, FOCUS_RING, cn } from '@goodboy/ui';
import { openGuideChapter } from '../../../settings/openGuideChapter';

export const CostGuideLink = () => (
  <div className="flex">
    <button
      type="button"
      onClick={() => openGuideChapter({ id: 'tokens' })}
      className={cn(
        'flex items-center gap-1 rounded-sm text-meta text-foreground underline decoration-border-soft underline-offset-3 hover:decoration-foreground',
        FOCUS_RING,
      )}
    >
      How cost is counted, in the Guide
      <ChevronRight size={ICON_SIZE.row} aria-hidden />
    </button>
  </div>
);

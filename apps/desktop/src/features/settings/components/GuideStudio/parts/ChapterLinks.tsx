import { ChevronRight } from 'lucide-react';
import { cn, FOCUS_RING, ICON_SIZE } from '@goodboy/ui';

import type { GuideLink, GuideTarget } from '../guideTarget';

type Props = {
  readonly links: ReadonlyArray<GuideLink>;
  readonly onOpen: (target: GuideTarget) => void;
};

export const ChapterLinks = ({ links, onOpen }: Props) => {
  if (links.length === 0) {
    return null;
  }
  return (
    <div data-chapter-links="" className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {links.map((link) => (
        <button
          key={link.label}
          type="button"
          onClick={() => onOpen(link.target)}
          className={cn(
            'flex items-center gap-0.5 rounded-sm text-ui text-primary hover:underline',
            FOCUS_RING,
          )}
        >
          {link.label}
          <ChevronRight size={ICON_SIZE.row} aria-hidden />
        </button>
      ))}
    </div>
  );
};

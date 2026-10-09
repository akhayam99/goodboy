import { ChevronRight } from 'lucide-react';
import { TRAIL_TAIL_CLASS } from './trailClasses';
import { ICON_SIZE } from '../../iconSize';

export const TrailSeparator = () => (
  <span data-trail-tail="" aria-hidden className={TRAIL_TAIL_CLASS}>
    <ChevronRight size={ICON_SIZE.row} />
  </span>
);

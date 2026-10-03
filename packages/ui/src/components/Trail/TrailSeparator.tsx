import { ChevronRight } from 'lucide-react';
import { TRAIL_TAIL_CLASS } from './trailClasses';

export const TrailSeparator = () => (
  <span data-trail-tail="" aria-hidden className={TRAIL_TAIL_CLASS}>
    <ChevronRight size={12} />
  </span>
);

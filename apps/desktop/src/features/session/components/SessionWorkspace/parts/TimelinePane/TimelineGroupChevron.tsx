import { ChevronRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

type Props = {
  readonly isExpanded: boolean;
};

export const TimelineGroupChevron = ({ isExpanded }: Props) => (
  <ChevronRight
    size={ICON_SIZE.control}
    aria-hidden
    className={cn(
      'shrink-0 self-center text-faint-foreground motion-safe:transition-transform',
      isExpanded && '-rotate-90',
    )}
  />
);

import { ChevronRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly open: boolean;
};

export const TranscriptChevron = ({ open }: Props) => (
  <ChevronRight
    size={ICON_SIZE.row}
    aria-hidden
    data-testid="transcript-chevron"
    className={cn(
      'shrink-0 text-faint-foreground motion-safe:transition-transform',
      open && 'rotate-90',
    )}
  />
);

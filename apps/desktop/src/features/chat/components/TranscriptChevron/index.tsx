import { ChevronRight } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly open: boolean;
};

export const TranscriptChevron = ({ open }: Props) => (
  <ChevronRight
    size={11}
    aria-hidden
    data-testid="transcript-chevron"
    className={cn(
      'shrink-0 text-muted-foreground/60 motion-safe:transition-transform',
      open && 'rotate-90',
    )}
  />
);

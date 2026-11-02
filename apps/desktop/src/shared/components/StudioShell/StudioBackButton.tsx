import { ChevronLeft } from 'lucide-react';
import { Button, cn, ICON_SIZE } from '@goodboy/ui';

type Props = {
  readonly isFullWidth?: boolean;
  readonly onBack: () => void;
};

export const StudioBackButton = ({ isFullWidth = false, onBack }: Props) => (
  <Button
    variant="quiet"
    size="sm"
    onClick={onBack}
    className={cn('shrink-0 justify-start', isFullWidth && 'w-full')}
  >
    <ChevronLeft size={ICON_SIZE.control} aria-hidden className="shrink-0" />
    <span className={cn('truncate text-left', isFullWidth && 'min-w-0 flex-1')}>Back to app</span>
    <span aria-hidden className="shrink-0 text-chip text-faint-foreground">
      Esc
    </span>
  </Button>
);

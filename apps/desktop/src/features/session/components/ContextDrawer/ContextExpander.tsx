import { ChevronRight } from '@goodboy/ui/icons';
import { Button, ICON_SIZE, cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly count?: number;
  readonly isOpen: boolean;
  readonly controlsId?: string;
  readonly onToggle: () => void;
};

export const ContextExpander = ({ label, count, isOpen, controlsId, onToggle }: Props) => (
  <Button
    variant="quiet"
    size="sm"
    aria-expanded={isOpen}
    aria-controls={controlsId}
    onClick={onToggle}
    data-context-expander=""
    className="self-start px-0 font-normal hover:bg-transparent"
  >
    <ChevronRight
      size={ICON_SIZE.row}
      aria-hidden
      className={cn('shrink-0 motion-safe:transition-transform', isOpen && 'rotate-90')}
    />
    {label}
    {count === undefined ? null : (
      <span className="tabular-nums text-faint-foreground">{count}</span>
    )}
  </Button>
);

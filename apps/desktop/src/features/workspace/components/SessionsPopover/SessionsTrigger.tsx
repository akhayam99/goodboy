import { ChevronDown, List } from '@goodboy/ui/icons';
import { Button, ICON_SIZE, Tooltip, cn } from '@goodboy/ui';

type Props = {
  readonly isOpen: boolean;
  readonly onToggle: () => void;
};

export const SessionsTrigger = ({ isOpen, onToggle }: Props) => (
  <Tooltip content="Sessions" shortcut="sessions.toggle" side="bottom">
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-label="Sessions"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      data-sessions-trigger=""
      className={cn('shrink-0 gap-1 px-2', isOpen && 'bg-selected text-foreground')}
    >
      <List size={ICON_SIZE.row} aria-hidden />
      <span>Sessions</span>
      <ChevronDown size={ICON_SIZE.row} aria-hidden />
    </Button>
  </Tooltip>
);

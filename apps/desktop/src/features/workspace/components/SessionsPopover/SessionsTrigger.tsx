import { ChevronDown, List } from '@goodboy/ui/icons';
import { Button, ICON_SIZE, StatusDot, Tooltip, cn } from '@goodboy/ui';
import { needYouWords } from '../../needYouWords';

type Props = {
  readonly isOpen: boolean;
  readonly needsYouCount: number;
  readonly onToggle: () => void;
};

export const SessionsTrigger = ({ isOpen, needsYouCount, onToggle }: Props) => (
  <Tooltip
    content={needsYouCount > 0 ? `Sessions, ${needYouWords({ count: needsYouCount })}` : 'Sessions'}
    shortcut="sessions.toggle"
    side="bottom"
  >
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
      {needsYouCount > 0 ? (
        <span data-sessions-needs-you="" className="flex">
          <StatusDot tone="warning" role="presentation" />
        </span>
      ) : null}
      <ChevronDown size={ICON_SIZE.row} aria-hidden />
    </Button>
  </Tooltip>
);

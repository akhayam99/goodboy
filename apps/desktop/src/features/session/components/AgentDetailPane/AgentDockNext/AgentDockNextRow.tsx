import { Button } from '@goodboy/ui';
import type { DockNext } from '../dockNextOf';

type Props = {
  readonly next: DockNext;
  readonly onOpen: () => void;
};

export const AgentDockNextRow = ({ next, onOpen }: Props) => (
  <div
    data-dock-row=""
    data-dock-next={next.card.id}
    className="flex min-h-7 min-w-0 items-center gap-2 text-meta text-muted-foreground"
  >
    <span className="shrink-0">Next:</span>
    <span className="min-w-0 truncate text-foreground">{next.card.title}</span>
    {next.moreCount === 0 ? null : (
      <span className="shrink-0 text-faint-foreground">{`· ${next.moreCount} more`}</span>
    )}
    <span className="flex-1" />
    <Button variant="quiet" size="xs" onClick={onOpen}>
      Open
    </Button>
  </div>
);

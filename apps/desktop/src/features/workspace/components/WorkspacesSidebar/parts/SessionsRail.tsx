import { Kanban, PanelLeftOpen, Plus } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';

export const SessionsRail = () => {
  const toggleSessionsSidebar = useAppStore((s) => s.toggleSessionsSidebar);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);

  return (
    <div className="flex w-full flex-col items-center gap-1 pt-2">
      <Tooltip content="show sessions · ⌘B" side="right">
        <button
          type="button"
          onClick={toggleSessionsSidebar}
          aria-label="show sessions"
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground motion-safe:transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <PanelLeftOpen size={15} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content="back to board" side="right">
        <button
          type="button"
          onClick={() => void setCurrentSession(null)}
          aria-label="back to board"
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground motion-safe:transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Kanban size={15} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content="new session · ⌘N" side="right">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
          aria-label="new session"
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground motion-safe:transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Plus size={15} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
};

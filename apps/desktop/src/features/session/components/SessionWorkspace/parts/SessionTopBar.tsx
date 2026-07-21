import { PanelLeftOpen } from 'lucide-react';
import { Divider, Tooltip, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SessionDetailPanel } from '../../../../workspace/components/SessionDetailPanel';

type SessionTopBarProps = {
  readonly session: Session;
};

export const SessionTopBar = ({ session }: SessionTopBarProps) => {
  const sessionsSidebarCollapsed = useAppStore((s) => s.sessionsSidebarCollapsed);
  const setSessionsSidebarCollapsed = useAppStore((s) => s.setSessionsSidebarCollapsed);

  return (
    <>
      <div
        className={cn(
          'flex w-full items-center gap-3 bg-background pr-3',
          sessionsSidebarCollapsed && 'pl-2',
        )}
      >
        {sessionsSidebarCollapsed ? (
          <Tooltip content="show sessions (⌘B)" side="bottom">
            <button
              type="button"
              onClick={() => setSessionsSidebarCollapsed(false)}
              aria-label="show sessions"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <PanelLeftOpen size={13} aria-hidden />
            </button>
          </Tooltip>
        ) : null}
        <div className="min-w-0 flex-1">
          <SessionDetailPanel
            session={session}
            onOpenSessionSettings={() =>
              window.dispatchEvent(new CustomEvent('goodboy:open-session-settings'))
            }
          />
        </div>
      </div>
      <Divider />
    </>
  );
};

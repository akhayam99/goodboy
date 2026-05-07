import { useState } from 'react';
import { Button, ScrollArea, cn } from '@kay-am/ui';
import { useAppStore, useCurrentSession, useCurrentWorkspace, useSessions } from '../store';
import { NewSessionDialog } from './NewSessionDialog';
import { StatusBadge } from './StatusBadge';

export function SessionsSidebar() {
  const workspace = useCurrentWorkspace();
  const sessions = useSessions();
  const current = useCurrentSession();
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs uppercase text-muted-foreground">sessions</span>
        <Button variant="ghost" size="sm" disabled={!workspace} onClick={() => setDialogOpen(true)}>
          + new
        </Button>
      </div>

      {!workspace ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">pick a workspace to begin</p>
      ) : (
        <ScrollArea className="flex-1">
          {sessions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">no sessions yet</p>
          ) : (
            <ul className="py-1">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => void setCurrentSession(session.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 px-3 py-2 text-left text-sm hover:bg-muted',
                      session.id === current?.id && 'bg-muted',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="line-clamp-1 flex-1">{session.goal}</span>
                      <StatusBadge state={session.state} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      )}

      {workspace ? (
        <NewSessionDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          workspaceId={workspace.id}
        />
      ) : null}
    </div>
  );
}

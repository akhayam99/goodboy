import { useState } from 'react';
import { Button, ScrollArea, cn } from '@kay-am/ui';
import type { ProviderId } from '@kay-am/types';
import { useAppStore, useCurrentSession, useCurrentWorkspace, useSessions } from '../store';
import { NewSessionDialog } from './NewSessionDialog';
import { OpenInEditorButton } from './OpenInEditorButton';
import { StatusBadge } from './StatusBadge';

interface SessionsSidebarProps {
  onOpenSettings: () => void;
}

const PROVIDER_CHIP_COLOR: Record<ProviderId, string> = {
  anthropic: 'bg-orange-100 text-orange-700',
  cursor: 'bg-blue-100 text-blue-700',
  codex: 'bg-green-100 text-green-700',
};

const PROVIDER_SHORT: Record<ProviderId, string> = {
  anthropic: 'cl',
  cursor: 'cu',
  codex: 'cx',
};

function ProviderChip({ providerId }: { providerId: ProviderId }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium leading-none',
        PROVIDER_CHIP_COLOR[providerId],
      )}
      title={providerId}
    >
      {PROVIDER_SHORT[providerId]}
    </span>
  );
}

export function SessionsSidebar({ onOpenSettings }: SessionsSidebarProps) {
  const workspace = useCurrentWorkspace();
  const sessions = useSessions();
  const current = useCurrentSession();
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const sessionWorktrees = useAppStore((s) => s.sessionWorktrees);
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
              {sessions.map((session) => {
                const isCurrent = session.id === current?.id;
                const worktreePath = sessionWorktrees[session.id] ?? null;
                return (
                  <li key={session.id} className="group">
                    <div
                      className={cn(
                        'flex flex-col gap-1 px-3 py-2 text-left text-sm hover:bg-muted',
                        isCurrent && 'bg-muted',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void setCurrentSession(session.id)}
                        className="flex w-full items-center justify-between gap-2"
                      >
                        <span className="line-clamp-1 flex-1">{session.goal}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <ProviderChip providerId={session.providerPreference.defaultProvider} />
                          <StatusBadge state={session.state} />
                        </div>
                      </button>
                      <div
                        className={cn(
                          'flex justify-end opacity-0 transition-opacity',
                          (isCurrent || worktreePath !== null) && 'group-hover:opacity-100',
                          isCurrent && 'opacity-100',
                        )}
                      >
                        <OpenInEditorButton worktreePath={worktreePath} label="vscode" />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      )}

      {workspace ? (
        <NewSessionDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          workspaceId={workspace.id}
          onOpenSettings={onOpenSettings}
        />
      ) : null}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { ProviderId, Session, Workspace, WorkspaceId } from '@kay-am/types';
import { useAppStore, useCurrentSession, useSessions } from '../store';
import { NewSessionDialog } from './NewSessionDialog';
import { OpenInEditorButton } from './OpenInEditorButton';
import { StatusBadge } from './StatusBadge';

interface WorkspaceTreeProps {
  workspace: Workspace;
  isActive: boolean;
  onSelectWorkspace: (id: WorkspaceId) => void;
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
        'inline-flex items-center rounded-sm px-1 py-0.5 text-[10px] font-medium leading-none',
        PROVIDER_CHIP_COLOR[providerId],
      )}
      title={providerId}
    >
      {PROVIDER_SHORT[providerId]}
    </span>
  );
}

export function WorkspaceTree({
  workspace,
  isActive,
  onSelectWorkspace,
  onOpenSettings,
}: WorkspaceTreeProps) {
  const [expanded, setExpanded] = useState(isActive);
  const sessionsAll = useSessions();
  const sessions = useMemo(
    () => (isActive ? sessionsAll : ([] as ReadonlyArray<Session>)),
    [isActive, sessionsAll],
  );

  const onClickHeader = () => {
    if (!isActive) {
      onSelectWorkspace(workspace.id);
      setExpanded(true);
      return;
    }
    setExpanded((v) => !v);
  };

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={onClickHeader}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
          isActive && 'bg-muted/60 text-foreground',
        )}
      >
        <span className="text-muted-foreground" aria-hidden>
          {expanded && isActive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
            isActive ? 'bg-primary' : 'bg-muted-foreground/40',
          )}
          aria-hidden
        />
        <span className="line-clamp-1 flex-1 font-medium">{workspace.name}</span>
      </button>

      {isActive && expanded ? (
        <SessionsBranch
          sessions={sessions}
          workspaceId={workspace.id}
          onOpenSettings={onOpenSettings}
        />
      ) : null}
    </li>
  );
}

interface SessionsBranchProps {
  sessions: ReadonlyArray<Session>;
  workspaceId: WorkspaceId;
  onOpenSettings: () => void;
}

function SessionsBranch({ sessions, workspaceId, onOpenSettings }: SessionsBranchProps) {
  const current = useCurrentSession();
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const sessionWorktrees = useAppStore((s) => s.sessionWorktrees);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="ml-3 flex flex-col gap-0.5 border-l border-border-soft pl-2">
      {sessions.length === 0 ? (
        <p className="px-2 py-1 text-[11px] text-muted-foreground">no sessions yet</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {sessions.map((session) => {
            const isCurrent = session.id === current?.id;
            const worktreePath = sessionWorktrees[session.id] ?? null;
            return (
              <li key={session.id} className="group">
                <div
                  className={cn(
                    'flex flex-col gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                    isCurrent && 'bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void setCurrentSession(session.id)}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                        isCurrent ? 'bg-primary' : 'bg-muted-foreground/30',
                      )}
                      aria-hidden
                    />
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

      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Plus size={12} aria-hidden /> new session
      </button>

      <NewSessionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        workspaceId={workspaceId}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}

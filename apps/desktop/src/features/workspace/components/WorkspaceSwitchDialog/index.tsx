import { Loader2 } from 'lucide-react';
import { Button, Dialog, cn } from '@goodboy/ui';
import { useAppStore, useWorkspaces } from '../../../../store';

export function WorkspaceSwitchDialog() {
  const pending = useAppStore((s) => s.pendingWorkspaceSwitch);
  const sessions = useAppStore((s) => s.sessions);
  const workspaces = useWorkspaces();
  const confirmWorkspaceSwitch = useAppStore((s) => s.confirmWorkspaceSwitch);
  const cancelWorkspaceSwitch = useAppStore((s) => s.cancelWorkspaceSwitch);

  if (!pending) return null;

  const running = sessions.filter((s) => s.state.kind === 'running');
  const count = running.length;
  const targetName =
    pending.targetId === null
      ? null
      : (workspaces.find((w) => w.id === pending.targetId)?.name ?? null);
  const subject = count === 1 ? 'agent is' : 'agents are';
  const them = count === 1 ? 'it' : 'them';

  return (
    <Dialog
      open
      onClose={cancelWorkspaceSwitch}
      title="Switch workspace?"
      description={`${count} ${subject} still running here. Switching away stops ${them} right now.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={cancelWorkspaceSwitch}>
            Stay here
          </Button>
          <Button variant="warning" onClick={() => void confirmWorkspaceSwitch()}>
            {targetName ? `Switch to ${targetName}` : 'Switch anyway'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1.5">
          {running.map((s) => {
            const isAutoMode = s.workflowRuns.some((r) => r.autoRun && !r.discardedAt);
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-md border border-border-soft bg-subtle px-3 py-2 text-xs"
              >
                <Loader2
                  size={12}
                  aria-hidden
                  className={cn('shrink-0 animate-spin', isAutoMode ? 'text-danger' : 'text-info')}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{s.goal}</span>
                {isAutoMode ? (
                  <span className="shrink-0 text-2xs font-medium uppercase tracking-wide text-danger">
                    auto
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Interrupted turns don&apos;t resume on their own. Anything already streamed is kept, so you
          can re-run after switching.
        </p>
      </div>
    </Dialog>
  );
}

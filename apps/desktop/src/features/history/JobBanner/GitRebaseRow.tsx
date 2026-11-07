import { Undo2 } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE, Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { useJobBannerActions } from '../hooks/useJobBannerActions';
import { REBASE_ABORT_CONFIRM } from '../components/rebaseAbortConfirm';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly actions: ReturnType<typeof useJobBannerActions>;
};

export const GitRebaseRow = ({ sessionId, worktreePath, actions }: Props) => {
  const openMountTerminal = useAppStore((s) => s.openMountTerminal);
  const { pendingKeys } = actions;
  const isBusy = pendingKeys.size > 0;
  return (
    <section
      aria-label="Rebase"
      data-rebase-stop="git"
      data-state="git-rebase"
      className="flex min-w-0 flex-col"
    >
      <Notice
        role="alert"
        tone="warning"
        placement="banner"
        title="Rebase in progress in the worktree"
        body="Goodboy did not start it. Continue it, or abort."
      >
        <div className="flex min-w-0 flex-col gap-3">
          {actions.failureLine === null ? null : (
            <div role="alert" className="flex min-w-0 items-center gap-2 text-meta text-danger">
              <span className="min-w-0 flex-1 break-words">{actions.failureLine}</span>
              <Button size="xs" variant="ghost" onClick={actions.retryFailed}>
                Retry
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              data-rebase-verb="continue"
              disabled={isBusy}
              isBusy={pendingKeys.has('continue')}
              onClick={actions.continueRebase}
            >
              Continue rebase
            </Button>
            <Button
              size="sm"
              variant="secondary"
              data-rebase-verb="open-terminal"
              disabled={isBusy}
              onClick={() => openMountTerminal(sessionId, worktreePath)}
            >
              Open terminal
            </Button>
            <ConfirmPopover
              role={REBASE_ABORT_CONFIRM.role}
              icon={<Undo2 size={ICON_SIZE.row} aria-hidden />}
              title={REBASE_ABORT_CONFIRM.title}
              description={REBASE_ABORT_CONFIRM.description}
              confirmLabel={REBASE_ABORT_CONFIRM.confirmLabel}
              onConfirm={actions.abortHere}
              trigger={({ arm }) => (
                <Button
                  size="sm"
                  variant="ghost"
                  data-rebase-verb="abort-here"
                  disabled={isBusy}
                  isBusy={pendingKeys.has('abort-here')}
                  onClick={arm}
                >
                  Abort rebase
                </Button>
              )}
            />
          </div>
        </div>
      </Notice>
    </section>
  );
};

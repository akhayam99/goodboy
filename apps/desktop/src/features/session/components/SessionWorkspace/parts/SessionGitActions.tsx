import { useEffect, useRef, useState } from 'react';
import { GitBranch, Upload } from 'lucide-react';
import type { Session, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { OverflowMenu, type OverflowMenuItem } from '../../../../../shared/components/OverflowMenu';
import { worktreeStatus } from '../../../../worktree/worktree';
import { resolveSessionRepo } from '../../../../../store/slices/worktrees/resolveSessionRepo';
import { useRebaseAgent } from '../../../hooks/useRebaseAgent';
import { usePushBranch } from '../../../hooks/usePushBranch';

type Props = {
  readonly session: Session;
};

const STATUS_REFRESH_INTERVAL_MS = 10_000;

const TRIGGER_BUTTON =
  'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

export const SessionGitActions = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const worktreePath = useAppStore(
    (state) => resolveSessionRepo({ state, sessionId })?.worktreePath ?? null,
  );
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [status, setStatus] = useState<WorktreeStatus | null>(null);
  const lastRefreshAt = useRef(0);
  const statusPath = useRef<string | null>(null);

  const notify = (title: string) => (message: string) => {
    void emitNotification('error', 'error', title, message, { sessionId });
  };

  const rebase = useRebaseAgent({ sessionId, status, onError: notify('Rebase failed') });
  const push = usePushBranch({ sessionId, onError: notify('Push failed') });

  useEffect(() => {
    if (worktreePath == null) {
      statusPath.current = null;
      setStatus(null);
      return;
    }
    let isDisposed = false;
    if (statusPath.current !== worktreePath) {
      statusPath.current = worktreePath;
      lastRefreshAt.current = Date.now() - STATUS_REFRESH_INTERVAL_MS;
      setStatus(null);
    }
    const refreshStatus = () => {
      const now = Date.now();
      if (now - lastRefreshAt.current < STATUS_REFRESH_INTERVAL_MS) {
        return;
      }
      lastRefreshAt.current = now;
      void worktreeStatus(worktreePath)
        .then((nextStatus) => {
          if (!isDisposed) {
            setStatus(nextStatus);
          }
        })
        .catch(() => undefined);
    };
    refreshStatus();
    window.addEventListener('focus', refreshStatus);
    return () => {
      isDisposed = true;
      window.removeEventListener('focus', refreshStatus);
    };
  }, [worktreePath]);

  if (worktreePath == null) {
    return null;
  }

  const canPush = status != null && status.ahead > 0;
  const items: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'rebase',
      label: rebase.isRunning ? 'Rebasing on main' : 'Rebase on main',
      icon: GitBranch,
      onClick: () => void rebase.run(),
      disabled: !rebase.canRebase || rebase.isRunning,
    },
    {
      kind: 'item',
      key: 'push',
      label: push.isBusy ? 'Pushing branch' : 'Push branch',
      icon: Upload,
      onClick: () => void push.run(),
      disabled: !canPush || push.isBusy,
    },
  ];

  return (
    <OverflowMenu
      items={items}
      label="branch actions"
      align="left"
      side="top"
      triggerClassName={TRIGGER_BUTTON}
      trigger={
        <>
          <GitBranch size={13} aria-hidden />
          <span>Branch</span>
        </>
      }
    />
  );
};

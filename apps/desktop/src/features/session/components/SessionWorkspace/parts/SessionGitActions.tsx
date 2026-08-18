import { useEffect, useRef, useState } from 'react';
import { OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { GitBranch, Upload } from 'lucide-react';
import type { Session, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { distanceAhead } from '../../../../../shared/lib/gitStatus';
import { worktreeStatus } from '../../../../worktree/worktree';
import { resolveSessionRepo } from '../../../../../store/slices/worktrees/resolveSessionRepo';
import { useRebaseAgent } from '../../../hooks/useRebaseAgent';
import { usePushBranch } from '../../../hooks/usePushBranch';
import type { Density } from '../../../density';

type Props = {
  readonly session: Session;
  readonly density?: Density;
};

const STATUS_REFRESH_INTERVAL_MS = 10_000;

const FULL_TRIGGER_BUTTON =
  'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

const COMPACT_TRIGGER_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

export const SessionGitActions = ({ session, density = 'full' }: Props) => {
  const sessionId = session.id as SessionId;
  const repo = useAppStore(useShallow((state) => resolveSessionRepo({ state, sessionId })));
  const worktreePath = repo?.worktreePath ?? null;
  const mountName = repo?.mountName ?? null;
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

  const ahead = status != null ? distanceAhead({ distance: status.upstreamDistance }) : null;
  const canPush = ahead != null && ahead > 0;
  const triggerClassName = density === 'compact' ? COMPACT_TRIGGER_BUTTON : FULL_TRIGGER_BUTTON;
  const triggerLabel = mountName == null ? 'Branch' : `${mountName} branch`;
  const items: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'rebase',
      label: rebase.isRunning
        ? `Rebasing${mountName == null ? '' : ` ${mountName}`} on main`
        : `Rebase${mountName == null ? '' : ` ${mountName}`} on main`,
      icon: GitBranch,
      onClick: () => void rebase.run(),
      disabled: !rebase.canRebase || rebase.isRunning,
    },
    {
      kind: 'item',
      key: 'push',
      label: push.isBusy
        ? `Pushing${mountName == null ? '' : ` ${mountName}`} branch`
        : `Push${mountName == null ? '' : ` ${mountName}`} branch`,
      icon: Upload,
      onClick: () => void push.run(),
      disabled: !canPush || push.isBusy,
    },
  ];

  return (
    <OverflowMenu
      items={items}
      label="Branch actions"
      tooltip="Rebase this branch on main, or push it"
      align="left"
      triggerClassName={triggerClassName}
      trigger={
        <>
          <GitBranch size={13} aria-hidden />
          <span className="density-trigger-label" data-density={density}>
            {triggerLabel}
          </span>
        </>
      }
    />
  );
};

import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { Button, ConfirmPopover, Notice } from '@goodboy/ui';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { worktreeAbortRebase } from '../../../../worktree/worktree';
import { useRebaseAgent } from '../../../hooks/useRebaseAgent';
import { ensure, worktreeStatusKey } from '../../../../../store/slices/worktreeStatuses/cache';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { rebaseStoppedBody } from './rebaseStoppedBody';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly baseBranch: string | null;
  readonly status: WorktreeStatus | null;
  readonly onOpenTerminal: () => void;
};

export const RebaseStoppedNotice = ({
  sessionId,
  mountId,
  worktreePath,
  baseBranch,
  status,
  onOpenTerminal,
}: Props) => {
  const reportError = useAppStore((state) => state.reportError);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const rebase = useRebaseAgent({
    sessionId,
    mountId,
    status,
    onError: (message) =>
      void reportError({
        title: "Couldn't hand the rebase to an agent",
        error: message,
        sessionId,
      }),
  });

  if (status === null || status.inProgress !== 'rebase' || rebase.isRunning || isAborted) {
    return null;
  }

  const abort = async () => {
    await worktreeAbortRebase({ worktreePath });
    setIsAborted(true);
    setIsConfirming(false);
    await ensure({
      key: worktreeStatusKey({ worktreePath, baseBranch: baseBranch ?? undefined }),
      worktreePath,
      baseBranch: baseBranch ?? undefined,
      maxAgeMs: 0,
    });
    setIsAborted(false);
  };

  return (
    <Notice
      tone="warning"
      placement="inline"
      role="status"
      title="Rebase stopped"
      body={rebaseStoppedBody({ status })}
      actions={
        <>
          <Button
            size="sm"
            disabled={!rebase.canResume}
            onClick={() => void rebase.resume({ mountId })}
          >
            Hand it to an agent
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenTerminal}>
            Open terminal
          </Button>
          <ConfirmPopover
            role="danger"
            icon={<Undo2 size={ICON_SIZE.row} aria-hidden />}
            title="Abort the rebase?"
            description="The branch returns to where it was before the rebase. Conflict fixes are lost."
            confirmLabel="Abort rebase"
            isOpen={isConfirming}
            onConfirm={abort}
            onCancel={() => setIsConfirming(false)}
            trigger={() => (
              <Button size="sm" variant="ghost" onClick={() => setIsConfirming(true)}>
                Abort rebase
              </Button>
            )}
          />
        </>
      }
    />
  );
};

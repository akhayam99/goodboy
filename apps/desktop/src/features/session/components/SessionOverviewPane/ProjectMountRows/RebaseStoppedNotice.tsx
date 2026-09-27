import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { Button, InlineConfirm, Notice, formatError } from '@goodboy/ui';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { worktreeAbortRebase } from '../../../../worktree/worktree';
import { useRebaseAgent } from '../../../hooks/useRebaseAgent';
import { ensure, worktreeStatusKey } from '../../../hooks/useWorktreeStatuses/cache';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { rebaseStoppedBody } from './mountRowState';

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
    try {
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
    } catch (error) {
      setIsConfirming(false);
      void reportError({
        title: "Couldn't abort the rebase",
        error: formatError(error),
        sessionId,
      });
    }
  };

  if (isConfirming) {
    return (
      <InlineConfirm
        role="danger"
        icon={<Undo2 size={ICON_SIZE.row} aria-hidden />}
        title="Abort the rebase?"
        description="The branch goes back to where it was before the rebase started. Conflict fixes made so far are lost."
        confirmLabel="Abort rebase"
        onConfirm={abort}
        onCancel={() => setIsConfirming(false)}
      />
    );
  }

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
          <Button size="sm" variant="ghost" onClick={() => setIsConfirming(true)}>
            Abort rebase
          </Button>
        </>
      }
    />
  );
};

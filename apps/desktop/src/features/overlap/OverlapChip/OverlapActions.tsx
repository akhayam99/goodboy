import { useState } from 'react';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { branchPlace } from '../../../store/slices/navigation/place';
import { NAMES } from '../../../shared/utils/names';
import { actionIntentOf } from '../../actions/actionIntentOf';
import { useImplementers } from '../hooks/useImplementers';
import { implementerNotesOf } from '../implementerNotesOf';
import { messageImplementers, type QueuedNote } from '../messageImplementers';
import type { OverlapGroup } from '../overlapGroupOf';

type Props = {
  readonly group: OverlapGroup;
  readonly onDone: () => void;
};

export const OverlapActions = ({ group, onDone }: Props) => {
  const [isSending, setIsSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<ReadonlyArray<QueuedNote> | null>(null);
  const navigate = useAppStore((state) => state.navigate);
  const worktreePath = useAppStore(
    (state) =>
      state.sessionProjectMounts[group.mount.sessionId]?.find(
        (mount) => mount.mountId === group.mount.mountId,
      )?.worktreePath ?? null,
  );
  const implementers = useImplementers({ steps: group.steps });
  const notes = implementerNotesOf({ group, implementers });
  const message = notes.length === 1 ? NAMES.messageTheImplementer : NAMES.messageTheImplementers;
  const canMessage = notes.length > 0 || attempt !== null;

  const send = async () => {
    const pending = attempt ?? notes.map((note) => ({ ...note, itemId: crypto.randomUUID() }));
    if (pending.length === 0 || isSending) {
      return;
    }
    setIsSending(true);
    setFailure(null);
    const outcome = await messageImplementers({ notes: pending });
    setIsSending(false);
    if (!outcome.isSent) {
      setFailure(outcome.failure);
      setAttempt(outcome.canRetry ? pending : null);
      return;
    }
    setAttempt(null);
    onDone();
  };

  const openChanges = () => {
    if (worktreePath === null) {
      return;
    }
    navigate({
      to: branchPlace({
        sessionId: group.mount.sessionId,
        mountPath: worktreePath,
        tab: 'files',
        focus: { kind: 'branch', path: group.sharedPaths[0] ?? null },
      }),
    });
    onDone();
  };

  if (!canMessage && worktreePath === null) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      {failure === null ? null : <p className="text-meta text-danger">{failure}</p>}
      <div className="flex flex-wrap gap-2">
        {canMessage ? (
          <Button
            variant="secondary"
            size="xs"
            intent={actionIntentOf({ verb: message })}
            isBusy={isSending}
            onClick={() => void send()}
          >
            {attempt === null ? message : NAMES.retry}
          </Button>
        ) : null}
        {worktreePath === null ? null : (
          <Button
            variant="quiet"
            size="xs"
            intent={actionIntentOf({ verb: NAMES.openInChanges })}
            onClick={openChanges}
          >
            {NAMES.openInChanges}
          </Button>
        )}
      </div>
    </div>
  );
};

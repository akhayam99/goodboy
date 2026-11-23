import { useMemo, useState } from 'react';
import { Button, Input, SelectableRow } from '@goodboy/ui';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useAppStore, useSessions } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly workspaceId: WorkspaceId;
  readonly hostSessionId: SessionId;
  readonly onClose: () => void;
};

const UNTITLED = 'Untitled session';

export const NewBranchInSession = ({
  projectId,
  projectName,
  workspaceId,
  hostSessionId,
  onClose,
}: Props) => {
  const sessions = useSessions();
  const forkMount = useAppStore((state) => state.forkMount);
  const reportError = useAppStore((state) => state.reportError);
  const [sessionId, setSessionId] = useState<SessionId>(hostSessionId);
  const [branch, setBranch] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const choices = useMemo(
    () =>
      sessions
        .filter((session) => session.workspaceId === workspaceId && session.archivedAt == null)
        .sort((a, b) => Number(b.id === hostSessionId) - Number(a.id === hostSessionId)),
    [sessions, workspaceId, hostSessionId],
  );
  const picked = choices.find((session) => session.id === sessionId);
  const pickedName = picked === undefined || picked.goal.trim() === '' ? UNTITLED : picked.goal;

  const create = async () => {
    if (isBusy || picked === undefined) {
      return;
    }
    setIsBusy(true);
    try {
      const trimmed = branch.trim();
      await forkMount({ sessionId, projectId, ...(trimmed === '' ? {} : { branch: trimmed }) });
      onClose();
    } catch (error) {
      setIsBusy(false);
      await reportError({
        recovery: CHECK_STATE,
        title: `Couldn't create a new branch in ${projectName}`,
        error,
        sessionId,
      });
    }
  };

  return (
    <div
      role="group"
      aria-label={`${NAMES.newBranch} in ${projectName}`}
      className="flex flex-col gap-2"
    >
      <div role="listbox" aria-label="Session" className="flex flex-col">
        {choices.map((session) => {
          const isPicked = session.id === sessionId;
          return (
            <SelectableRow
              key={session.id}
              role="option"
              selected={isPicked}
              ariaSelected={isPicked}
              onClick={() => {
                if (!isBusy) {
                  setSessionId(session.id);
                }
              }}
            >
              <span className="truncate text-ui">
                {session.goal.trim() === '' ? UNTITLED : session.goal}
              </span>
            </SelectableRow>
          );
        })}
      </div>
      <Input
        value={branch}
        autoFocus
        disabled={isBusy}
        aria-label="Branch name"
        placeholder="Leave empty to name it automatically"
        onChange={(event) => setBranch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          void create();
        }}
        className="h-8 w-full text-meta"
      />
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" disabled={isBusy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          isBusy={isBusy}
          disabled={isBusy || picked === undefined}
          onClick={() => void create()}
        >
          {`${NAMES.newBranch} in ${pickedName}`}
        </Button>
      </div>
    </div>
  );
};

import { Button } from '@goodboy/ui';
import { pluralize } from '../../utils/pluralize';
import type { FolderConflict } from './folderEntry';
import { FolderNotice } from './FolderNotice';

type Props = {
  readonly name: string;
  readonly conflict: FolderConflict;
  readonly destinationName: string;
  readonly isBusy: boolean;
  readonly onMove: () => void;
  readonly onUndo: () => void;
  readonly onLeave: () => void;
};

type ConflictParams = {
  readonly conflict: FolderConflict;
};

const sessionsOf = ({ conflict }: ConflictParams): string =>
  pluralize(conflict.sessionCount, 'session');

const waitingBodyOf = ({ conflict }: ConflictParams): string => {
  if (conflict.runningAgentCount > 0) {
    return `Stop its ${pluralize(conflict.runningAgentCount, 'running agent')} there to move it.`;
  }
  if (conflict.sessionCount === 0) {
    return 'Moving it takes it out of there.';
  }
  return 'Moving it brings its sessions along.';
};

type MovedParams = ConflictParams & {
  readonly destination: string;
};

const movedBodyOf = ({ conflict, destination }: MovedParams): string =>
  conflict.isShell
    ? `It moves on Create. ${conflict.workspaceName} has no other folders, so it joins ${destination}.`
    : `It moves on Create. ${conflict.workspaceName} keeps its other folders.`;

export const ConflictNotice = ({
  name,
  conflict,
  destinationName,
  isBusy,
  onMove,
  onUndo,
  onLeave,
}: Props) => {
  const destination = destinationName.trim() === '' ? 'this workspace' : destinationName.trim();
  if (conflict.choice === 'move') {
    return (
      <FolderNotice
        tone="success"
        title={`${name} moves to ${destination} with its ${sessionsOf({ conflict })}.`}
        body={movedBodyOf({ conflict, destination })}
        actions={
          <Button variant="ghost" size="xs" disabled={isBusy} onClick={onUndo}>
            Undo
          </Button>
        }
      />
    );
  }
  return (
    <FolderNotice
      tone="warning"
      title={`${name} is already in ${conflict.workspaceName}, with ${sessionsOf({ conflict })}.`}
      body={waitingBodyOf({ conflict })}
      actions={
        <>
          <Button
            variant="secondary"
            size="xs"
            disabled={isBusy || conflict.runningAgentCount > 0}
            onClick={onMove}
          >
            Move it here
          </Button>
          <Button variant="ghost" size="xs" disabled={isBusy} onClick={onLeave}>
            Leave it out
          </Button>
        </>
      }
    />
  );
};

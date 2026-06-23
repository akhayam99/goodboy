import { Network } from 'lucide-react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { RunsBoard } from '../RunsBoard';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly sessions: ReadonlyArray<Session>;
  readonly focusSessionId?: SessionId | null;
  readonly onClose: () => void;
};

export const RunsStudio = ({
  workspaceId,
  workspaceName,
  sessions,
  focusSessionId,
  onClose,
}: Props) => {
  return (
    <StudioShell
      icon={Network}
      title="Orchestration"
      workspaceName={workspaceName}
      closeLabel="close orchestration"
      onClose={onClose}
    >
      {(requestClose) => (
        <div className="min-h-0 min-w-0 flex-1">
          <RunsBoard
            workspaceId={workspaceId}
            sessions={sessions}
            focusSessionId={focusSessionId}
            requestClose={requestClose}
          />
        </div>
      )}
    </StudioShell>
  );
};

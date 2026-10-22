import { PaneShell } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { SessionKickoff } from '../SessionKickoff';
import { KeepDraftNotice } from './KeepDraftNotice';
import { SessionDraftActions } from './SessionDraftActions';
import { useSessionDraftClose } from './useSessionDraftClose';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const SessionDraftPane = ({ workspaceId }: Props) => {
  const { isAsking, keepDraft } = useSessionDraftClose({ workspaceId });
  return (
    <div className="@container relative flex h-full w-full min-w-0 flex-col">
      <PaneShell
        title="New session"
        actions={<SessionDraftActions workspaceId={workspaceId} />}
        headerRhythm="section"
        width="measure"
        animationClassName="animate-fade-in"
      >
        <SessionKickoff
          key={workspaceId}
          workspaceId={workspaceId}
          notice={isAsking ? <KeepDraftNotice onKeep={keepDraft} /> : null}
        />
      </PaneShell>
    </div>
  );
};

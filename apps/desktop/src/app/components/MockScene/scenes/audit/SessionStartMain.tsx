import { useAppStore, useCurrentSession } from '../../../../../store';
import { selectIsSessionDraftShown } from '../../../../../store/slices/sessionDraft/selectIsSessionDraftShown';
import { SessionDraftPane } from '../../../../../features/session/components/SessionDraftPane';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { WORKSPACE_ID } from '../workflowSeed';

export const SessionStartMain = () => {
  const isDraftShown = useAppStore((state) => selectIsSessionDraftShown({ state }));
  const session = useCurrentSession();
  if (isDraftShown) {
    return <SessionDraftPane workspaceId={WORKSPACE_ID} />;
  }
  if (session === null) {
    return null;
  }
  return (
    <div className="relative h-full w-full">
      <SessionWorkspace key={session.id} session={session} isActive />
    </div>
  );
};

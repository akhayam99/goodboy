import type { Session } from '@goodboy/types';
import { useCurrentWorkspace, type SessionStudio } from '../../../../../store';
import { WorkflowBuilderView } from '../../WorkflowBuilderView';
import { GitHubSessionPane } from '../../../../github/components/GitHubSessionPane';
import { MrSessionPane } from '../../../../integrations/gitlab/MrSessionPane';

type Props = {
  readonly session: Session;
  readonly studio: SessionStudio;
  readonly onClose: () => void;
};

export const SessionStudioLayer = ({ session, studio, onClose }: Props) => {
  const workspace = useCurrentWorkspace();
  if (!workspace) {
    return null;
  }
  const workspaceName = workspace.name;
  return (
    <div className="animate-fade-in absolute inset-0 z-20 bg-background">
      {studio.kind === 'workflow' ? (
        <WorkflowBuilderView session={session} onClose={onClose} />
      ) : studio.kind === 'github' ? (
        <GitHubSessionPane
          sessionId={session.id}
          workspaceName={workspaceName}
          initialPrNumber={studio.prNumber ?? null}
          initialThreadId={studio.threadId ?? null}
          onClose={onClose}
        />
      ) : (
        <MrSessionPane sessionId={session.id} workspaceName={workspaceName} onClose={onClose} />
      )}
    </div>
  );
};

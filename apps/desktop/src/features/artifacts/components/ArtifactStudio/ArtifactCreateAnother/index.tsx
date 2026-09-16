import type { SessionArtifact, SessionId } from '@goodboy/types';
import { CreateReportCta } from '../../../../reports/components/CreateReportCta';
import { CreateWireframeCta } from '../../../../wireframes/components/CreateWireframeCta';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly isWorkflowOwned: boolean;
};

export const ArtifactCreateAnother = ({ sessionId, artifact, isWorkflowOwned }: Props) => {
  if (artifact.kind === 'plan') {
    return null;
  }

  const title = isWorkflowOwned
    ? 'create another from this workflow run'
    : 'create another from this';

  return (
    <span data-testid="artifact-create-another" className="inline-flex min-w-0">
      {artifact.kind === 'report' ? (
        <CreateReportCta
          sessionId={sessionId}
          workflowRunId={artifact.workflowRunId}
          title={title}
        />
      ) : (
        <CreateWireframeCta
          sessionId={sessionId}
          workflowRunId={artifact.workflowRunId}
          title={title}
        />
      )}
    </span>
  );
};

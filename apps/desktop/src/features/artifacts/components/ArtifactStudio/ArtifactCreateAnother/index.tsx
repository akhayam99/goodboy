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

  return (
    <div
      data-testid="artifact-create-another"
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      <span className="text-2xs text-muted-foreground">
        {isWorkflowOwned ? 'create another from this workflow run' : 'create another from this'}
      </span>
      {artifact.kind === 'report' ? (
        <CreateReportCta sessionId={sessionId} workflowRunId={artifact.workflowRunId} />
      ) : (
        <CreateWireframeCta sessionId={sessionId} workflowRunId={artifact.workflowRunId} />
      )}
    </div>
  );
};

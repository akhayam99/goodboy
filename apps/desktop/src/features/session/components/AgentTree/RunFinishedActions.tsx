import type { ReactNode } from 'react';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { CreateReportCta } from '../../../reports/components/CreateReportCta';
import { CreateWireframeCta } from '../../../wireframes/components/CreateWireframeCta';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly trailing?: ReactNode;
};

export const RunFinishedActions = ({ sessionId, workflowRunId, trailing = null }: Props) => (
  <div className="flex shrink-0 flex-wrap items-center gap-1">
    <CreateReportCta sessionId={sessionId} workflowRunId={workflowRunId} />
    <CreateWireframeCta sessionId={sessionId} workflowRunId={workflowRunId} />
    {trailing}
  </div>
);

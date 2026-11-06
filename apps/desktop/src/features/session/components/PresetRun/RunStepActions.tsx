import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { WORKFLOW_RUN_KIND } from '../../../actions/kinds/workflowRun';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly stepAgentId: AgentId;
};

const STEP_VERBS: ReadonlySet<string> = new Set([
  'workflowRun.stepTranscript',
  'workflowRun.skipStep',
]);

const NOT_STEP_VERBS: ReadonlyArray<string> = WORKFLOW_RUN_KIND.actions
  .map((action) => action.id)
  .filter((id) => !STEP_VERBS.has(id));

export const RunStepActions = ({ sessionId, runId, stepAgentId }: Props) => (
  <ObjectOverflowMenu
    target={{ kind: 'workflowRun', sessionId, runId, stepAgentId }}
    label="Step actions"
    anchorKey={`workflow-step:${stepAgentId}`}
    size="control"
    omit={NOT_STEP_VERBS}
    hideWhenEmpty
  />
);

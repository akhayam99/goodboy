import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { ObjectOverflowMenu } from '../../../actions/ObjectOverflowMenu';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly stepAgentId: AgentId;
};

const STEP_VERBS: ReadonlyArray<string> = [
  'workflowRun.stepRename',
  'workflowRun.stepTranscript',
  'workflowRun.skipStep',
];

export const RunStepActions = ({ sessionId, runId, stepAgentId }: Props) => (
  <ObjectOverflowMenu
    target={{ kind: 'workflowRun', sessionId, runId, stepAgentId }}
    label="Step actions"
    anchorKey={`workflow-step:${stepAgentId}`}
    size="control"
    only={STEP_VERBS}
    minEntries={1}
    hideWhenEmpty
  />
);

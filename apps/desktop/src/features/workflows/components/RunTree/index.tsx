import type { AgentId, OpenQuestion, SessionId, WorkflowRunId } from '@goodboy/types';
import type { RunTreeRouting } from './RunTreeRow';
import { RunTreeRows } from './RunTreeRows';
import type { RunTreeModel } from './useRunTree';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly tree: RunTreeModel | null;
  readonly routing: RunTreeRouting;
  readonly selectedAgentId: AgentId | null;
  readonly highlightedStepId: string | null;
  readonly onHighlight: (stepId: string | null) => void;
  readonly onSelect: (id: AgentId) => void;
  readonly onAnswer: (question: OpenQuestion | null) => void;
};

export const RunTree = ({
  sessionId,
  runId,
  tree,
  routing,
  selectedAgentId,
  highlightedStepId,
  onHighlight,
  onSelect,
  onAnswer,
}: Props) => {
  if (tree === null) {
    return null;
  }
  return (
    <RunTreeRows
      sessionId={sessionId}
      tree={tree}
      scrollKey={runId}
      label="Workflow steps"
      testId="run-tree"
      routing={routing}
      selectedAgentId={selectedAgentId}
      highlightedStepId={highlightedStepId}
      onHighlight={onHighlight}
      onSelect={onSelect}
      onAnswer={onAnswer}
    />
  );
};

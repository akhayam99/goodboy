import { useMemo } from 'react';
import type { AgentId, OpenQuestion, SessionId, WorkflowRunId } from '@goodboy/types';
import { useSessionPlans } from '../../../../store';
import type { RunTreeRouting } from './RunTreeRow';
import { RunTreeRows } from './RunTreeRows';
import type { RunStepSkipAction } from './RunStepSkip';
import { plansByAgentId } from './plansByAgentId';
import { useFoldedRunTree } from './useFoldedRunTree';
import type { RunTreeModel } from './useRunTree';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly tree: RunTreeModel | null;
  readonly routing: RunTreeRouting;
  readonly selectedAgentId: AgentId | null;
  readonly highlightedStepId: string | null;
  readonly skip?: RunStepSkipAction | null;
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
  skip = null,
  onHighlight,
  onSelect,
  onAnswer,
}: Props) => {
  const folded = useFoldedRunTree({ tree });
  const sessionPlans = useSessionPlans(sessionId);
  const plans = useMemo(() => plansByAgentId({ plans: sessionPlans }), [sessionPlans]);
  if (folded === null) {
    return null;
  }
  return (
    <RunTreeRows
      sessionId={sessionId}
      tree={folded.tree}
      scrollKey={runId}
      label="Run steps"
      testId="run-tree"
      routing={routing}
      selectedAgentId={selectedAgentId}
      highlightedStepId={highlightedStepId}
      skip={skip}
      folds={folded.folds}
      plans={plans}
      onHighlight={onHighlight}
      onSelect={onSelect}
      onAnswer={onAnswer}
    />
  );
};

import { useMemo, type ReactNode } from 'react';
import type { AgentId, OpenQuestion, SessionId, WorkflowRunId } from '@goodboy/types';
import { useSessionPlans } from '../../../../store';
import { waveLabelsOf } from '../../../plans/waves/waveLabelsOf';
import type { RunTreeRouting } from './RunTreeRow';
import { RunTreeRows } from './RunTreeRows';
import type { RunTreeInsert } from '../../runTreeInsert';
import type { RunStepSkipAction } from './RunStepSkip';
import { plansByAgentId } from './plansByAgentId';
import { useFoldedRunTree } from './useFoldedRunTree';
import type { RunTreeModel } from './useRunTree';
import type { RunTreeDensity } from './runTreeDensity';

type Props = {
  readonly density?: RunTreeDensity;
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly tree: RunTreeModel | null;
  readonly routing: RunTreeRouting;
  readonly selectedAgentId: AgentId | null;
  readonly highlightedStepId: string | null;
  readonly skip?: RunStepSkipAction | null;
  readonly beforeRow?: (insert: RunTreeInsert) => ReactNode;
  readonly trailing?: (insert: RunTreeInsert) => ReactNode;
  readonly onHighlight: (stepId: string | null) => void;
  readonly onSelect: (id: AgentId) => void;
  readonly onAnswer: (question: OpenQuestion | null) => void;
};

export const RunTree = ({
  density = 'page',
  sessionId,
  runId,
  tree,
  routing,
  selectedAgentId,
  highlightedStepId,
  skip = null,
  beforeRow,
  trailing,
  onHighlight,
  onSelect,
  onAnswer,
}: Props) => {
  const folded = useFoldedRunTree({ tree });
  const sessionPlans = useSessionPlans(sessionId);
  const plans = useMemo(() => plansByAgentId({ plans: sessionPlans }), [sessionPlans]);
  const waveLabels = useMemo(
    () =>
      waveLabelsOf({
        plans: sessionPlans,
        agents:
          tree === null
            ? []
            : tree.stream.items.flatMap((item) =>
                item.kind === 'row' && item.entry.kind === 'agent' ? [item.entry.agent] : [],
              ),
      }),
    [sessionPlans, tree],
  );
  if (folded === null) {
    return null;
  }
  return (
    <RunTreeRows
      density={density}
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
      waveLabels={waveLabels}
      {...(beforeRow !== undefined && { beforeRow })}
      {...(trailing !== undefined && { trailing })}
      onHighlight={onHighlight}
      onSelect={onSelect}
      onAnswer={onAnswer}
    />
  );
};

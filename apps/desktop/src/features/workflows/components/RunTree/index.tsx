import type { AgentId, OpenQuestion, Session, Workflow, WorkflowRun } from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';
import type { RunTreeRouting } from './RunTreeRow';
import { RunTreeRows } from './RunTreeRows';
import { useRunTree } from './useRunTree';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
  readonly routing: RunTreeRouting;
  readonly selectedAgentId: AgentId | null;
  readonly onSelect: (id: AgentId) => void;
  readonly onAnswer: (question: OpenQuestion | null) => void;
};

export const RunTree = ({
  session,
  run,
  workflow,
  agentKindOverride,
  routing,
  selectedAgentId,
  onSelect,
  onAnswer,
}: Props) => {
  const tree = useRunTree({ session, run, workflow, agentKindOverride });
  if (tree === null) {
    return null;
  }
  return (
    <RunTreeRows
      sessionId={session.id}
      tree={tree}
      scrollKey={run.id}
      label="Workflow steps"
      testId="run-tree"
      routing={routing}
      selectedAgentId={selectedAgentId}
      onSelect={onSelect}
      onAnswer={onAnswer}
    />
  );
};

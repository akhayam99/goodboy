import type { AgentId, OpenQuestion, Session } from '@goodboy/types';
import type { RunTreeRouting } from './RunTreeRow';
import { RunTreeRows } from './RunTreeRows';
import { useSubagentTree } from './useSubagentTree';

type Props = {
  readonly session: Session;
  readonly rootAgentId: AgentId;
  readonly childIds: ReadonlySet<AgentId>;
  readonly routing: RunTreeRouting;
  readonly onSelect: (id: AgentId) => void;
  readonly onAnswer: (question: OpenQuestion | null) => void;
};

export const SubagentTree = ({
  session,
  rootAgentId,
  childIds,
  routing,
  onSelect,
  onAnswer,
}: Props) => {
  const tree = useSubagentTree({ session, rootAgentId, childIds });
  if (tree === null) {
    return null;
  }
  return (
    <RunTreeRows
      sessionId={session.id}
      tree={tree}
      scrollKey={rootAgentId}
      label="Subagents"
      testId="subagent-tree"
      routing={routing}
      selectedAgentId={rootAgentId}
      onSelect={onSelect}
      onAnswer={onAnswer}
    />
  );
};

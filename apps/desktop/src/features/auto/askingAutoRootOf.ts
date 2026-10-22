import type { AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { autoTreeOfAgent } from './autoTreeOfAgent';

type AskedQuestion = {
  readonly createdByAgentId?: AgentId | null;
};

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly questions: ReadonlyArray<AskedQuestion>;
};

export const askingAutoRootOf = ({ views, questions }: Params): AgentId | null => {
  const roots = new Set<AgentId | null>(
    questions.map((question) => {
      const agentId = question.createdByAgentId ?? null;
      if (agentId === null) {
        return null;
      }
      return autoTreeOfAgent({ views, agentId })?.view.tree.rootAgentId ?? null;
    }),
  );
  if (roots.size !== 1) {
    return null;
  }
  const [root] = roots;
  return root ?? null;
};

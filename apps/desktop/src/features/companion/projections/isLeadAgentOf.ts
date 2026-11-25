import type { Agent } from '@goodboy/types';
import type { WorkspaceScope } from './workspaceScope';

const LEAD_NAME = 'Lead';

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
  readonly agent: Agent;
};

export const isLeadAgentOf = ({ scope, sessionId, agent }: Params): boolean =>
  agent.name === LEAD_NAME ||
  (scope.trees[sessionId] ?? []).some((view) => view.tree.rootAgentId === agent.id);

import type { Agent } from '@goodboy/types';
import type { WorkspaceScope } from './workspaceScope';

type Params = {
  readonly scope: Pick<WorkspaceScope, 'agentRunHistory'>;
  readonly agent: Agent;
};

export const agentRunIdsOf = ({ scope, agent }: Params): ReadonlySet<string> =>
  new Set([
    ...(agent.runId === undefined ? [] : [agent.runId]),
    ...(scope.agentRunHistory?.[agent.id] ?? []),
  ]);

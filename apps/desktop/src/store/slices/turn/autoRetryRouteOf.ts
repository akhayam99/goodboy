import { parseAutoDelegationRole } from '@goodboy/core';
import type { Agent, AgentId } from '@goodboy/types';
import { autoTreeOfAgent } from '../../../features/auto/autoTreeOfAgent';
import { AGENT_KIND_META, kindForRole } from '../../../features/session/agent-kind';
import type { AutoTreeView } from '../auto-view/state';
import { AUTO_CONFINED_ROLE } from './confinedRoleOf';

export type AutoRetryRoute = Readonly<{
  rootAgentId: AgentId;
  message: string;
}>;

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly runs: ReadonlyArray<Pick<Agent, 'id' | 'kind' | 'parentAgentId'>>;
  readonly agentId: AgentId;
};

const GENERIC_MESSAGE = 'Continue the agent that stopped from where it left off.';

type MessageParams = {
  readonly delegationId: string;
  readonly role: string;
  readonly task: unknown;
};

const messageOf = ({ delegationId, role, task }: MessageParams): string => {
  const parsed = parseAutoDelegationRole({ role });
  if (parsed === null) {
    return GENERIC_MESSAGE;
  }
  const noun = AGENT_KIND_META[kindForRole({ role: parsed })].noun;
  const lead = `Continue the ${noun} that stopped (delegation ${delegationId}) from where it left off`;
  return typeof task === 'string' && task !== '' ? `${lead}: ${task}` : `${lead}.`;
};

export const autoRetryRouteOf = ({ views, runs, agentId }: Params): AutoRetryRoute | null => {
  const tree = autoTreeOfAgent({ views, agentId });
  if (tree?.kind === 'child') {
    return {
      rootAgentId: tree.view.tree.rootAgentId,
      message: messageOf({
        delegationId: tree.delegation.id,
        role: tree.delegation.role,
        task: tree.delegation.request.task,
      }),
    };
  }
  if (tree?.kind === 'root') {
    return null;
  }
  const agent = runs.find((candidate) => candidate.id === agentId);
  const parent = runs.find((candidate) => candidate.id === agent?.parentAgentId);
  if (parent === undefined || parent.kind !== AUTO_CONFINED_ROLE) {
    return null;
  }
  return { rootAgentId: parent.id, message: GENERIC_MESSAGE };
};

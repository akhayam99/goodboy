import { parseAutoDelegationRole } from '@goodboy/core/auto';
import type { AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { AGENT_KIND_META, kindForRole, type AgentKind } from '../session/agent-kind';
import { taskTitleOf } from './taskTitleOf';

type Params = {
  readonly views: ReadonlyArray<AutoTreeView> | undefined;
  readonly agentId: AgentId;
};

export type AgentTaskLabel = Readonly<{
  kind: AgentKind;
  role: string;
  title: string;
}>;

export const agentTaskLabelOf = ({ views, agentId }: Params): AgentTaskLabel | null => {
  let first: AutoTreeView['delegations'][number] | null = null;
  for (const view of views ?? []) {
    for (const delegation of view.delegations) {
      if (delegation.childAgentId !== agentId) {
        continue;
      }
      if (first === null || delegation.createdAt < first.createdAt) {
        first = delegation;
      }
    }
  }
  if (first === null) {
    return null;
  }
  const title = taskTitleOf({ request: first.request });
  if (title === null) {
    return null;
  }
  const parsed = parseAutoDelegationRole({ role: first.role });
  const kind: AgentKind = parsed === null ? 'generic' : kindForRole({ role: parsed });
  return { kind, role: AGENT_KIND_META[kind].noun, title };
};

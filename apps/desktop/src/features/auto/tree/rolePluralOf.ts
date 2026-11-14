import { parseAutoDelegationRole } from '@goodboy/core/auto';
import { AGENT_KIND_META, kindForRole, type AgentKind } from '../../session/agent-kind';

type Params = {
  readonly role: string;
};

export const rolePluralOf = ({ role }: Params): string => {
  const parsed = parseAutoDelegationRole({ role });
  const kind: AgentKind = parsed === null ? 'generic' : kindForRole({ role: parsed });
  return AGENT_KIND_META[kind].pluralLabel;
};

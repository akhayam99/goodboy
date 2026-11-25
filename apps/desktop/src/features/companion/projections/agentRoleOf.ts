import type { Agent } from '@goodboy/types';

type Params = {
  readonly agent: Agent;
  readonly isLead: boolean;
};

export const agentRoleOf = ({ agent, isLead }: Params): string => {
  if (isLead) {
    return 'Lead';
  }
  const kind = agent.kind;
  if (kind === undefined || kind.length === 0) {
    return 'Agent';
  }
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
};

import type { AgentKind } from '../../agent-kind';
import { isDefaultAgentName } from '../../isDefaultAgentName';

type Params = {
  readonly name: string;
  readonly kind: AgentKind;
  readonly brief: string | null;
};

export const agentHeadingOf = ({ name, kind, brief }: Params): string => {
  if (!isDefaultAgentName({ name, kind }) || brief === null) {
    return name;
  }
  return brief;
};

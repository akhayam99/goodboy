import type { AgentKindRouting } from './agent-kind';

type Params = {
  readonly left: AgentKindRouting;
  readonly right: AgentKindRouting;
};

export const isSameRouting = ({ left, right }: Params): boolean =>
  left.provider === right.provider && left.model === right.model && left.effort === right.effort;

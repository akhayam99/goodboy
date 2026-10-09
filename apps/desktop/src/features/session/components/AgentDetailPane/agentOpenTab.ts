import type { AgentPane } from '../../../../store/slices/navigation/types';

export type AgentTab = AgentPane;

type Params = {
  readonly requested: AgentTab | null;
  readonly remembered: AgentTab | null;
};

export const agentOpenTab = ({ requested, remembered }: Params): AgentTab =>
  requested ?? remembered ?? 'brief';

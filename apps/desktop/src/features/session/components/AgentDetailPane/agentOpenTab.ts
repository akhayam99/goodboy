import type { AgentPane } from '../../../../store/slices/navigation/types';

export type AgentTab = AgentPane;

type Params = {
  readonly requested: AgentTab | null;
  readonly remembered: AgentTab | null;
  readonly hasBrief: boolean;
};

export const agentOpenTab = ({ requested, remembered, hasBrief }: Params): AgentTab =>
  requested ?? remembered ?? (hasBrief ? 'brief' : 'transcript');

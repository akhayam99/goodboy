import type { LensKind } from '../../../../store';
import type { AgentHomeLens } from '../../agent-kind';

const AGENT_LIST_LENSES: ReadonlyArray<AgentHomeLens> = ['agents', 'resolve', 'workflows'];

type Params = {
  readonly lens: LensKind | null;
  readonly agentHome: AgentHomeLens | null;
};

export const resolveOverlayHome = ({ lens, agentHome }: Params): AgentHomeLens =>
  AGENT_LIST_LENSES.find((candidate) => candidate === lens) ?? agentHome ?? 'agents';

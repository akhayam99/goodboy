import type { AgentId } from '@goodboy/types';

export const MAX_UNATTENDED_TURNS_PER_AGENT = 4;

export const UNATTENDED_WINDOW_MS = 60 * 60 * 1000;

type Params = Readonly<{
  agentId: AgentId;
}>;

export type WorkflowTurnClaim = 'granted' | 'tripped';

const sends = new Map<AgentId, ReadonlyArray<number>>();

export const claimWorkflowTurn = ({
  agentId,
  nowMs,
}: Params & Readonly<{ nowMs: number }>): WorkflowTurnClaim => {
  const recent = (sends.get(agentId) ?? []).filter((at) => nowMs - at < UNATTENDED_WINDOW_MS);
  if (recent.length >= MAX_UNATTENDED_TURNS_PER_AGENT) {
    sends.set(agentId, recent);
    return 'tripped';
  }
  sends.set(agentId, [...recent, nowMs]);
  return 'granted';
};

export const clearWorkflowTurns = ({ agentId }: Params): void => {
  sends.delete(agentId);
};

export const resetWorkflowTurnBreaker = (): void => {
  sends.clear();
};

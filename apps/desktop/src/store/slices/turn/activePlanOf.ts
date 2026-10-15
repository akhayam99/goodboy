import type { AgentId, SessionId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
}>;

export type ActivePlan = Readonly<{
  id: string;
  revision: number | null;
  bodyMd: string;
}>;

export const activePlanOf = ({ get, sessionId, agentId }: Params): ActivePlan | null => {
  const state = get();
  const artifact = (state.sessionArtifacts[sessionId] ?? []).find(
    (candidate) =>
      candidate.kind === 'plan' && candidate.agentId === agentId && candidate.status === 'active',
  );
  if (artifact !== undefined) {
    return { id: artifact.id, revision: artifact.revision, bodyMd: artifact.sourceText };
  }
  const plan = (state.sessionPlans[sessionId] ?? []).find(
    (candidate) => candidate.agentId === agentId && candidate.status === 'active',
  );
  return plan === undefined ? null : { id: plan.id, revision: null, bodyMd: plan.bodyMd };
};

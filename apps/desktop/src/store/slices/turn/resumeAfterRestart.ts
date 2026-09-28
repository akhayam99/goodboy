import type { AgentId, IsoDateTime, ProviderId, ProviderRunId, SessionId } from '@goodboy/types';
import { planRestartResume, type RestartReason } from './planRestartResume';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly reason: RestartReason;
};

export type ResumeAfterRestartResult = 'resumed' | 'unresumable' | 'blocked';

export const resumeAfterRestart = async ({
  get,
  sessionId,
  agentId,
  reason,
}: Params): Promise<ResumeAfterRestartResult> => {
  if (get().transcripts[agentId] === undefined) {
    await get().loadAgentTranscript(sessionId, agentId);
  }
  const state = get();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.id === agentId,
  );
  if (session === undefined || agent === undefined) {
    return 'unresumable';
  }
  const provider: ProviderId =
    agent.providerSessionProviderId ?? session.providerPreference.defaultProvider;
  const plan = planRestartResume({
    agent,
    provider,
    isProviderConnected: state.authResults?.[provider]?.state !== 'disconnected',
    transcript: state.transcripts[agentId] ?? [],
    reason,
  });
  if (plan.kind === 'unresumable') {
    return 'unresumable';
  }
  get().appendTurnEvent(agentId, sessionId, {
    kind: 'decision_note',
    runId: (agent.runId ?? `restart-${agentId}`) as ProviderRunId,
    message: plan.note,
    at: new Date().toISOString() as IsoDateTime,
  });
  const result = await get().sendTurn({ sessionId, agentId, content: plan.prompt });
  return result.blockedOverBudget ? 'blocked' : 'resumed';
};

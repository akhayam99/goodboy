import type { LeadDeliveryPart } from '@goodboy/core/auto';
import type { HandoffBodyLayers } from '@goodboy/core/handoff';
import type { Agent, AgentId, ProviderId } from '@goodboy/types';
import { leadCandidatesBlock } from '../../../runtime/auto/childRouting/leadCandidatesBlock';
import { resumeSessionIdOf } from '../resumeSessionIdOf';
import type { GetFn, SendTurnInput } from '../types';
import { planLeadTurn, type LeadTurn } from './planLeadTurn';
import { readLeadLastTurn } from './readLeadLastTurn';

type Params = Readonly<{
  get: GetFn;
  input: SendTurnInput;
  agentId: AgentId;
  agent: Agent | null;
  isLeadAgent: boolean;
  provider: ProviderId;
  model: string;
  runId: string;
  layers: HandoffBodyLayers;
  preamble: ReadonlyArray<LeadDeliveryPart>;
}>;

export const prepareLeadTurn = async ({
  get,
  input,
  agentId,
  agent,
  isLeadAgent,
  provider,
  model,
  runId,
  layers,
  preamble,
}: Params): Promise<LeadTurn | null> => {
  const delivery = input.leadDelivery;
  const isLayered =
    layers.priorTurns === '' && layers.clusterBoundary === null && layers.currentPlan === '';
  if (delivery === undefined || provider !== 'anthropic' || !isLeadAgent || !isLayered) {
    return null;
  }
  const nowMs = Date.now();
  return planLeadTurn({
    agentId,
    runId,
    resumeSessionId: resumeSessionIdOf({ origin: input.origin, agent, provider }) ?? null,
    lastTurn: await readLeadLastTurn({ sessionId: input.sessionId, agentId }),
    model,
    nowMs,
    delivery,
    content: input.content,
    layers,
    preamble,
    candidates: await leadCandidatesBlock({ state: get(), sessionId: input.sessionId, nowMs }),
  });
};

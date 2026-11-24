import {
  bestCandidate,
  buildCandidates,
  resolveModelIdForProvider,
  stepSizeOf,
} from '@goodboy/core/providers';
import type { Agent, SessionId, Step } from '@goodboy/types';
import { KIND_TO_ROLE, classifyAgent } from '../../../features/session/agent-kind';
import { sessionById } from '../sessions/sessionIndex';
import type { GetFn, SetFn } from '../workflows/types';
import { applyWorkflowNodeRouting } from './applyWorkflowNodeRouting';
import { earlierPicksOf } from './earlierPicksOf';
import { providerCauseOf } from './providerCauseOf';
import { movedDecision } from './movedDecision';
import { stepCandidateInputs } from './stepCandidateInputs';
import { writerFamilyOf } from './writerFamilyOf';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly step: Step | null;
};

type KeptParams = {
  readonly get: GetFn;
  readonly agent: Agent;
};

const isStoredPickKept = ({ get, agent }: KeptParams): boolean => {
  const selected = agent.routingDecision?.selected ?? null;
  if (selected === null) {
    return false;
  }
  const state = get();
  const provider = state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null;
  const model = state.agentModelOverride[agent.id] ?? agent.modelOverride ?? null;
  return (
    provider === selected.provider &&
    (model === selected.model ||
      model === resolveModelIdForProvider({ provider: selected.provider, modelId: selected.model }))
  );
};

export const recheckPendingStepRouting = async ({
  set,
  get,
  sessionId,
  agent,
  step,
}: Params): Promise<void> => {
  const decision = agent.routingDecision ?? null;
  if (
    agent.status !== 'pending' ||
    agent.routingLock != null ||
    decision === null ||
    !isStoredPickKept({ get, agent })
  ) {
    return;
  }
  const run = sessionById(get().sessions, sessionId)?.workflowRuns.find(
    (candidate) => candidate.id === agent.workflowRunId,
  );
  if (run === undefined) {
    return;
  }
  const inputs = await stepCandidateInputs({
    get,
    sessionId,
    runProviders: run.providerPool,
    rules: run.rulesSnapshot,
  });
  const kind = classifyAgent({ agent, override: get().agentKindOverride[agent.id] ?? null });
  const role = step?.role ?? KIND_TO_ROLE[kind];
  const earlier = earlierPicksOf({
    state: get(),
    sessionId,
    workflowRunId: run.id,
    beforeOrdinal: agent.ordinal,
  });
  const list = buildCandidates({
    inputs,
    need: {
      role,
      size: step?.size ?? stepSizeOf({ difficulty: agent.taskProfile?.difficulty }),
      scope: 'step',
      writerFamily: writerFamilyOf({ role, earlier }),
    },
  });
  const cause = providerCauseOf({ list, provider: decision.selected.provider });
  const best = cause === null ? null : bestCandidate({ list });
  if (cause === null || best === null) {
    return;
  }
  await applyWorkflowNodeRouting({
    set,
    sessionId,
    nodeKind: 'agent',
    id: agent.id,
    lock: null,
    decision: movedDecision({
      list,
      candidate: best,
      cause,
      asked: decision.selected,
      proposal: decision.proposal,
    }),
    taskProfile: agent.taskProfile ?? null,
  });
};

import type {
  WorkflowRoutingProposalParseOutcome,
  WorkflowRoutingResolution,
  WorkflowRoutingWireFields,
} from '@goodboy/core/orchestrator';
import type { AgentRole, WorkflowRun } from '@goodboy/types';
import {
  resolveProposedRouting,
  type ResolveProposedRoutingParams,
} from '../workflows/resolveProposedRouting';
import type { GetFn } from '../workflows/types';
import { earlierPicksOf } from './earlierPicksOf';
import { resolveOrchestratedStepRouting } from './resolveOrchestratedStepRouting';
import { stepCandidateInputs } from './stepCandidateInputs';

type Params = Omit<
  ResolveProposedRoutingParams,
  'state' | 'isModelPickEnabled' | 'providerPool' | 'role' | 'fields' | 'promptText'
> &
  Readonly<{
    get: GetFn;
    run: WorkflowRun;
    step: WorkflowRoutingWireFields & Readonly<{ role: AgentRole; promptPrefix: string }>;
    isCandidatesBlockSent: boolean;
  }>;

type OrchestratedRouting = Readonly<{
  routingProposal: WorkflowRoutingProposalParseOutcome;
  resolution: WorkflowRoutingResolution;
}>;

export const orchestratedStepRouting = async ({
  get,
  run,
  step,
  isCandidatesBlockSent,
  ...rest
}: Params): Promise<OrchestratedRouting> => {
  const request = { ...rest, role: step.role, fields: step, promptText: step.promptPrefix };
  const isModelPickEnabled = run.rulesSnapshot?.canOrchestratorPickModel === true;
  const isOnCandidates =
    (request.stepLock ?? null) === null &&
    request.availability.isSessionBudgetBlocked !== true &&
    (!isModelPickEnabled || isCandidatesBlockSent);
  const onCandidates = isOnCandidates
    ? resolveOrchestratedStepRouting({
        inputs: await stepCandidateInputs({
          get,
          sessionId: request.sessionId,
          runProviders: run.providerPool,
          rules: run.rulesSnapshot,
        }),
        role: request.role,
        fields: request.fields,
        isModelPickEnabled,
        promptText: request.promptText,
        emittingProvider: request.emittingProvider,
        earlier: earlierPicksOf({
          state: get(),
          sessionId: request.sessionId,
          workflowRunId: run.id,
        }),
      })
    : null;
  if (onCandidates?.decision == null) {
    const { routingProposal, resolution } = resolveProposedRouting({
      ...request,
      state: get(),
      isModelPickEnabled,
      providerPool: run.providerPool ?? null,
    });
    return { routingProposal, resolution };
  }
  return {
    routingProposal: onCandidates.routingProposal,
    resolution: { kind: 'ready', decision: onCandidates.decision },
  };
};

import type { Agent, AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  classifyWorkflowChain,
  findReusableAgent,
  isAgentStatusSettled,
  runsForWorkflowRun,
} from '@goodboy/core';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { isRunPaused } from '../../../features/workflows/isRunPaused';
import { findWorkflowRun } from './findWorkflowRun';
import { notifyWorkflowGateBlock } from './notifyWorkflowGateBlock';
import { WorkflowGateError } from './workflowActivationGate';
import type { GetFn, SetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

export type SkipStepOptions = {
  readonly onlyWhenBlocked?: boolean;
  readonly force?: boolean;
  readonly agentId?: AgentId;
};

type SkipParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly options: SkipStepOptions;
};

type TargetParams = SkipParams & {
  readonly runs: ReadonlyArray<Agent>;
};

const isTurnLive = ({ get, agentId }: { readonly get: GetFn; readonly agentId: AgentId }) => {
  const turn = get().agentTurnState[agentId];
  return turn?.kind === 'running' || turn?.kind === 'starting';
};

const findTarget = ({ get, sessionId, workflowRunId, options, runs }: TargetParams) => {
  const session = sessionById(get().sessions, sessionId);
  const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
  if (session == null || run == null || run.discardedAt != null) {
    return null;
  }
  const template = (get().phaseTemplates[session.workspaceId] ?? []).find(
    (candidate) => candidate.id === run.workflowId,
  );
  if (template == null) {
    return null;
  }
  if (options.agentId !== undefined) {
    const named = runs.find((agent) => agent.id === options.agentId) ?? null;
    if (named == null || isAgentStatusSettled({ status: named.status })) {
      return null;
    }
    return { run, template, agent: named };
  }
  const chain = classifyWorkflowChain(template, runs);
  if (chain.kind === 'complete') {
    return null;
  }
  if (options.onlyWhenBlocked === true && chain.kind !== 'blocked') {
    return null;
  }
  const step = chain.kind === 'blocked' ? chain.failedStep : chain.step;
  const agent = findReusableAgent(runs, step.id);
  if (agent == null || agent.status === 'pending') {
    return null;
  }
  return { run, template, agent };
};

type NextStepErrorParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly error: unknown;
};

const notifyNextStepError = ({ get, sessionId, error }: NextStepErrorParams): void => {
  if (error instanceof WorkflowGateError) {
    notifyWorkflowGateBlock({ error, sessionId, emitNotification: get().emitNotification });
    return;
  }
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: "The next step didn't start",
    body: formatError(error),
    sessionId,
  });
};

const runSkipAndAdvance = async (params: SkipParams): Promise<void> => {
  const { set, get, sessionId, workflowRunId, options } = params;
  const runs = runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId);
  const target = findTarget({ ...params, runs });
  if (target == null) {
    return;
  }
  const { template, agent } = target;
  const isLive = isTurnLive({ get, agentId: agent.id });
  const isUnseededRunning = agent.status === 'running' && get().agentTurnState[agent.id] == null;
  if ((isLive || isUnseededRunning) && options.force !== true) {
    return;
  }
  if (isLive) {
    await get().cancelCurrentTurn(sessionId, agent.id);
  }
  await invokeAgentUpdateStatus(agent.id, { status: 'skipped', completedAt: nowIso() });
  const refreshed = await invokeAgentList(sessionId);
  set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
  void get().refreshUnreadWorkspaces();

  const current = findWorkflowRun({ get, sessionId, workflowRunId });
  if (current == null || current.autoRun !== true || isRunPaused({ run: current })) {
    return;
  }
  const refreshedRunAgents = runsForWorkflowRun(refreshed, workflowRunId);
  if (refreshedRunAgents.some((candidate) => candidate.status === 'running')) {
    return;
  }
  const nextChain = classifyWorkflowChain(template, refreshedRunAgents);
  if (nextChain.kind === 'step') {
    const nextAgent = refreshedRunAgents.find(
      (candidate) => candidate.stepId === nextChain.step.id && candidate.status === 'pending',
    );
    if (nextAgent != null) {
      void get()
        .activateWorkflowAgent({
          sessionId,
          agentId: nextAgent.id,
          focus: 'agent',
          bypassGate: true,
        })
        .catch((error: unknown) => notifyNextStepError({ get, sessionId, error }));
      return;
    }
  }
  if (current.executionMode === 'dynamic' && current.orchestrationOutcome == null) {
    void get().orchestrateNextStep(sessionId, workflowRunId, { bypassGate: true });
  }
};

export const skipStuckStepAndAdvance = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    options: SkipStepOptions = {},
  ): Promise<void> => {
    try {
      await runSkipAndAdvance({ set, get, sessionId, workflowRunId, options });
    } catch (error) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "Couldn't skip the step",
        body: formatError(error),
        sessionId,
      });
    }
  };
};

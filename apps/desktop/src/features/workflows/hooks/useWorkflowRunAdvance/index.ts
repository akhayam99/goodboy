import { useMemo } from 'react';
import type { Agent, OpenQuestion, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../store';
import { workflowRunOpenQuestions } from '../../../context/openQuestionsGate';
import { resolveWorkflowAdvance, type WorkflowAdvanceState } from '../../advanceGate';

type Params = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export type WorkflowRunAdvance = {
  readonly state: WorkflowAdvanceState;
  readonly runAgents: ReadonlyArray<Agent>;
  readonly stepAgents: ReadonlyArray<Agent>;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

export const useWorkflowRunAdvance = ({ sessionId, run, workflow }: Params): WorkflowRunAdvance => {
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const isSummarizerRunning = useAppStore(
    (state) => state.summarizerStatus?.[sessionId]?.status === 'running',
  );
  const openQuestions = useSessionOpenQuestions(sessionId);
  const runAgents = useMemo(() => runsForWorkflowRun(phaseRuns, run.id), [phaseRuns, run.id]);
  const stepAgents = useMemo(
    () => runAgents.filter((agent) => agent.parentAgentId == null && agent.stepId != null),
    [runAgents],
  );
  const questions = useMemo(
    () => workflowRunOpenQuestions({ questions: openQuestions, run }),
    [openQuestions, run],
  );
  const hasRunningTurn = useAppStore((state) =>
    stepAgents.some((agent) => {
      const turn = state.agentTurnState[agent.id];
      return turn?.kind === 'running' || turn?.kind === 'starting';
    }),
  );
  const isTurnRunning = hasRunningTurn || stepAgents.some((agent) => agent.status === 'running');
  const isAutoRun = run.autoRun === true;
  const state = useMemo(
    () =>
      resolveWorkflowAdvance({
        workflow,
        agents: stepAgents,
        hasOpenQuestions: questions.length > 0,
        isSummarizerRunning,
        isTurnRunning,
        isAutoRun,
      }),
    [workflow, stepAgents, questions, isSummarizerRunning, isTurnRunning, isAutoRun],
  );
  return { state, runAgents, stepAgents, questions };
};

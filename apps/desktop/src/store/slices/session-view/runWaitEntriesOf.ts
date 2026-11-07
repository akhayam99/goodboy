import type { Agent, Session, Workflow, WorkflowRunId } from '@goodboy/types';
import { splitWorkflowRuns } from '../../../features/workflows/activeWorkflowRuns';
import { runRowFactsOf } from '../../../features/workflows/runRowFactsOf';
import type { RunWait } from '../../../features/workflows/runStateOf';
import type { AppState } from '../../types';
import {
  isRunRevisingPlanIn,
  type PlanReviewState,
} from '../../../features/plans/isRunRevisingPlanIn';

export type RunWaitState = PlanReviewState &
  Partial<
    Pick<
      AppState,
      'sessionOpenQuestions' | 'orchestratingWorkflowRuns' | 'phaseTemplates' | 'sessionWorkflows'
    >
  >;

export type RunWaitEntry = {
  readonly runId: WorkflowRunId;
  readonly wait: RunWait;
  readonly word: string;
};

type Params = {
  readonly state: RunWaitState;
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const runWaitEntriesOf = ({
  state,
  session,
  agents,
}: Params): ReadonlyArray<RunWaitEntry> => {
  const sessionId = session.id;
  const workflowById = new Map<string, Workflow>();
  for (const workflow of state.phaseTemplates?.[session.workspaceId] ?? []) {
    workflowById.set(workflow.id, workflow);
  }
  for (const workflow of state.sessionWorkflows?.[sessionId] ?? []) {
    workflowById.set(workflow.id, workflow);
  }
  const attachedRuns = session.workflowRuns.flatMap((run) => {
    const workflow = workflowById.get(run.workflowId);
    return workflow === undefined ? [] : [{ run, workflow }];
  });
  if (attachedRuns.length === 0) {
    return [];
  }
  const { agentsByRunId } = splitWorkflowRuns({ attachedRuns, agents });
  const questions = state.sessionOpenQuestions?.[sessionId] ?? [];
  return attachedRuns.flatMap(({ run, workflow }) => {
    const { wait, word } = runRowFactsOf({
      run,
      workflow,
      agents: agentsByRunId.get(run.id) ?? NO_AGENTS,
      predecessorName: 'previous',
      isOrchestrating: state.orchestratingWorkflowRuns?.[run.id] ?? false,
      questions,
      isPlanRevising: isRunRevisingPlanIn({ state, sessionId, run }),
    });
    return wait === null ? [] : [{ runId: run.id, wait, word }];
  });
};

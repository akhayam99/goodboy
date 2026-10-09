import { runsForWorkflowRun } from '@goodboy/core';
import type {
  Agent,
  OpenQuestion,
  Session,
  SessionId,
  Workflow,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { nextRunMove, type RunMove } from './nextRunMove';

export type IdleRun = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly move: Exclude<RunMove, { readonly kind: 'none' }>;
  readonly isFresh: boolean;
};

type AdvancingParams = {
  readonly sessionId: SessionId;
};

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<Agent>>>;
  readonly phaseTemplates: Readonly<Record<WorkspaceId, ReadonlyArray<Workflow>>>;
  readonly sessionOpenQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly orchestratingWorkflowRuns: Readonly<Record<WorkflowRunId, boolean>>;
  readonly pendingOrchestrations: Readonly<Record<WorkflowRunId, unknown>>;
  readonly isSessionAdvancing: (params: AdvancingParams) => boolean;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];
const NO_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

export const findIdleRuns = ({
  sessions,
  sessionPhaseRuns,
  phaseTemplates,
  sessionOpenQuestions,
  orchestratingWorkflowRuns,
  pendingOrchestrations,
  isSessionAdvancing,
}: Params): ReadonlyArray<IdleRun> => {
  const idle: Array<IdleRun> = [];
  for (const session of sessions) {
    if (session.archivedAt != null || session.deletedAt != null) {
      continue;
    }
    if (isSessionAdvancing({ sessionId: session.id })) {
      continue;
    }
    const agents = sessionPhaseRuns[session.id] ?? NO_AGENTS;
    const templates = phaseTemplates[session.workspaceId] ?? [];
    for (const run of session.workflowRuns) {
      if (
        run.executionMode !== 'dynamic' ||
        run.autoRun !== true ||
        run.discardedAt != null ||
        run.triggerMode !== 'immediate' ||
        run.orchestrationOutcome != null ||
        run.orchestrationStop != null
      ) {
        continue;
      }
      if (orchestratingWorkflowRuns[run.id] === true || pendingOrchestrations[run.id] != null) {
        continue;
      }
      const runAgents = runsForWorkflowRun(agents, run.id);
      const move = nextRunMove({
        run,
        template: templates.find((template) => template.id === run.workflowId),
        agents: runAgents,
        openQuestions: sessionOpenQuestions[session.id] ?? NO_QUESTIONS,
      });
      if (move.kind === 'none') {
        continue;
      }
      idle.push({ sessionId: session.id, run, move, isFresh: runAgents.length === 0 });
    }
  }
  return idle;
};

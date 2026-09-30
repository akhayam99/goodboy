import {
  Ban,
  CircleCheck,
  Copy,
  MessageCircleQuestion,
  Play,
  RotateCcw,
  StepForward,
  Undo2,
} from 'lucide-react';
import type { AgentId, OpenQuestionId, SessionId, WorkflowRun } from '@goodboy/types';
import { isAgentStatusHalted } from '@goodboy/core';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { notifyWorkflowGateBlock } from '../../../store/slices/workflows/notifyWorkflowGateBlock';
import { resolveWorkflowAdvance } from '../../workflows/advanceGate';
import { viewWorkflowAdvance } from '../../workflows/workflowAdvanceView';
import { workflowRunOpenQuestions } from '../../context/openQuestionsGate';
import { isWorkflowRunClosable } from '../../workflows/isWorkflowRunClosable';
import { isWorkflowRunComplete } from '../../workflows/isWorkflowRunComplete';
import { CLOSE_WORKFLOW_COPY } from '../../workflows/closeWorkflowCopy';
import { useOpenQuestions } from '../../context/components/QuestionsTab/useOpenQuestions';
import type { ActionEnv, ObjectKindDefinition, WorkflowRunActionTarget } from '../types';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';

type WorkflowRunState = 'queued' | 'running' | 'paused' | 'failed' | 'done' | 'discarded';

export type WorkflowRunFacts = {
  readonly run: WorkflowRun;
  readonly sessionId: SessionId;
  readonly name: string;
  readonly state: WorkflowRunState;
  readonly isClosable: boolean;
  readonly openQuestionId: OpenQuestionId | null;
  readonly stoppedAgentId: AgentId | null;
  readonly readyAgentId: AgentId | null;
  readonly readyStepName: string | null;
  readonly hasChanges: boolean;
  readonly summary: string;
};

const openRun = ({ env, facts }: { readonly env: ActionEnv; readonly facts: WorkflowRunFacts }) =>
  env.getState().navigate({
    to: sessionPlace({
      sessionId: facts.sessionId,
      lens: 'workflows',
      target: { kind: 'run', runId: facts.run.id },
    }),
  });

type StateParams = {
  readonly isDiscarded: boolean;
  readonly isQueued: boolean;
  readonly isComplete: boolean;
  readonly isHalted: boolean;
  readonly isRunning: boolean;
};

const runStateOf = ({
  isDiscarded,
  isQueued,
  isComplete,
  isHalted,
  isRunning,
}: StateParams): WorkflowRunState => {
  if (isDiscarded) {
    return 'discarded';
  }
  if (isComplete) {
    return 'done';
  }
  if (isQueued) {
    return 'queued';
  }
  if (isRunning) {
    return 'running';
  }
  return isHalted ? 'failed' : 'paused';
};

const isLive = ({ facts }: { readonly facts: WorkflowRunFacts }): boolean =>
  facts.state !== 'discarded' && facts.state !== 'done';

export const WORKFLOW_RUN_KIND: ObjectKindDefinition<WorkflowRunActionTarget, WorkflowRunFacts> = {
  noun: 'workflow run',
  facts: ({ state, target }) => {
    const session = sessionById(state.sessions, target.sessionId) ?? null;
    const run = session?.workflowRuns.find((candidate) => candidate.id === target.runId) ?? null;
    if (session === null || run === null) {
      return null;
    }
    const workflow =
      (state.sessionWorkflows[target.sessionId] ?? []).find(
        (candidate) => candidate.id === run.workflowId,
      ) ?? null;
    const agents = (state.sessionPhaseRuns[target.sessionId] ?? []).filter(
      (agent) => agent.workflowRunId === run.id && agent.deletedAt == null,
    );
    const questions = workflowRunOpenQuestions({
      questions: state.sessionOpenQuestions[target.sessionId] ?? [],
      run,
    });
    const isRunning = agents.some(
      (agent) =>
        agent.status === 'running' ||
        state.agentTurnState[agent.id]?.kind === 'running' ||
        state.agentTurnState[agent.id]?.kind === 'starting',
    );
    const view =
      workflow === null
        ? null
        : viewWorkflowAdvance({
            state: resolveWorkflowAdvance({
              workflow,
              agents,
              hasOpenQuestions: questions.length > 0,
              isSummarizerRunning: false,
              isTurnRunning: isRunning,
            }),
          });
    const manualStep = view?.manualStep ?? null;
    const readyAgent =
      manualStep === null
        ? null
        : (agents.find((agent) => agent.stepId === manualStep.id && agent.status === 'pending') ??
          null);
    const stoppedAgent = agents.find((agent) => agent.status === 'stopped') ?? null;
    const name = run.title ?? workflow?.name ?? 'Workflow';
    const mounts = state.sessionProjectMounts[target.sessionId] ?? [];
    return {
      run,
      sessionId: target.sessionId,
      name,
      state: runStateOf({
        isDiscarded: run.discardedAt != null,
        isQueued: run.triggerMode !== 'immediate' && agents.length === 0,
        isComplete: isWorkflowRunComplete({ run, workflow, agents }),
        isHalted: agents.some((agent) => isAgentStatusHalted({ status: agent.status })),
        isRunning,
      }),
      isClosable: workflow !== null && isWorkflowRunClosable({ run, workflow, agents }),
      openQuestionId: questions[0]?.id ?? null,
      stoppedAgentId: stoppedAgent?.id ?? null,
      readyAgentId: readyAgent?.id ?? null,
      readyStepName: manualStep?.name ?? null,
      hasChanges: mounts.length > 0,
      summary: [name, ...agents.map((agent) => `- ${agent.name}: ${agent.status}`)].join('\n'),
    };
  },
  actions: [
    {
      id: 'workflowRun.open',
      label: 'Open run',
      icon: CONCEPT_ICONS.workflows,
      group: 'open',
      when: ({ facts, viewing }) =>
        !(viewing?.kind === 'workflowRun' && viewing.id === facts.run.id),
      run: ({ facts, env }) => openRun({ env, facts }),
    },
    {
      id: 'workflowRun.diff',
      label: 'View diff',
      icon: CONCEPT_ICONS.diff,
      group: 'open',
      when: ({ facts }) => facts.hasChanges,
      run: ({ facts, env }) =>
        env
          .getState()
          .navigate({ to: sessionPlace({ sessionId: facts.sessionId, lens: 'files' }) }),
    },
    {
      id: 'workflowRun.answer',
      label: 'Answer',
      icon: MessageCircleQuestion,
      group: 'act',
      when: ({ facts }) => facts.openQuestionId !== null && isLive({ facts }),
      run: ({ facts, env }) => {
        if (facts.openQuestionId !== null) {
          useOpenQuestions.getState().focusQuestion(facts.openQuestionId);
        }
        env
          .getState()
          .navigate({ to: sessionPlace({ sessionId: facts.sessionId, lens: 'questions' }) });
      },
    },
    {
      id: 'workflowRun.start',
      label: 'Start run',
      icon: Play,
      group: 'act',
      when: ({ facts }) => facts.state === 'queued' && facts.run.triggerMode === 'manual',
      run: ({ facts, env }) => env.getState().startWorkflowRun(facts.sessionId, facts.run.id),
    },
    {
      id: 'workflowRun.continue',
      label: 'Continue step',
      icon: StepForward,
      group: 'act',
      when: ({ facts }) => facts.stoppedAgentId !== null && isLive({ facts }),
      run: ({ facts, env }) => {
        if (facts.stoppedAgentId !== null) {
          void env
            .getState()
            .continueStoppedAgent({ sessionId: facts.sessionId, agentId: facts.stoppedAgentId });
        }
      },
    },
    {
      id: 'workflowRun.restartStep',
      label: 'Restart step',
      icon: RotateCcw,
      group: 'act',
      when: ({ facts }) => facts.state === 'failed',
      run: ({ facts, env }) =>
        env
          .getState()
          .recoverStuckStep({ sessionId: facts.sessionId, workflowRunId: facts.run.id }),
    },
    {
      id: 'workflowRun.nextStep',
      label: ({ facts }) =>
        facts.readyStepName === null ? 'Start next step' : `Start ${facts.readyStepName}`,
      icon: StepForward,
      group: 'act',
      when: ({ facts }) => facts.readyAgentId !== null && facts.state === 'paused',
      run: async ({ facts, env }) => {
        if (facts.readyAgentId === null) {
          return;
        }
        try {
          await env.getState().activateWorkflowAgent({
            sessionId: facts.sessionId,
            agentId: facts.readyAgentId,
            focus: 'none',
            bypassGate: false,
          });
        } catch (error) {
          notifyWorkflowGateBlock({
            error,
            sessionId: facts.sessionId,
            emitNotification: env.getState().emitNotification,
          });
        }
      },
    },
    {
      id: 'workflowRun.restore',
      label: 'Restore',
      icon: Undo2,
      group: 'act',
      when: ({ facts }) => facts.state === 'discarded',
      run: ({ facts, env }) => env.getState().restoreWorkflow(facts.sessionId, facts.run.id),
    },
    {
      id: 'workflowRun.copySummary',
      label: 'Copy run summary',
      icon: Copy,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.summary }),
    },
    {
      id: 'workflowRun.close',
      label: CLOSE_WORKFLOW_COPY.label,
      icon: CircleCheck,
      group: 'danger',
      when: ({ facts }) => facts.isClosable && isLive({ facts }),
      confirm: () => ({
        title: CLOSE_WORKFLOW_COPY.title,
        description: CLOSE_WORKFLOW_COPY.description,
        confirmLabel: CLOSE_WORKFLOW_COPY.label,
        role: 'alert',
      }),
      run: ({ facts, env }) => env.getState().closeWorkflowRun(facts.sessionId, facts.run.id),
    },
    {
      id: 'workflowRun.discard',
      label: 'Discard workflow',
      icon: Ban,
      group: 'danger',
      when: ({ facts }) => facts.state !== 'discarded',
      confirm: () => ({
        title: 'Discard workflow?',
        description:
          'Moves the run to Discarded, where you can restore it. Agents already started stay in the session.',
        confirmLabel: 'Discard',
        role: 'alert',
      }),
      run: ({ facts, env }) => env.getState().discardWorkflow(facts.sessionId, facts.run.id),
    },
    {
      id: 'workflowRun.delete',
      label: 'Delete workflow run',
      icon: CONCEPT_ICONS.delete,
      group: 'danger',
      when: () => true,
      confirm: () => ({
        title: 'Delete workflow run?',
        description: 'Permanently removes this workflow run from the session.',
        confirmLabel: 'Delete',
        role: 'danger',
      }),
      run: ({ facts, env }) =>
        env.getState().detachWorkflowFromSession(facts.sessionId, facts.run.id),
    },
  ],
};

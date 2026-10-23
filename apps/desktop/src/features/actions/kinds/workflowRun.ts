import {
  Copy,
  ListChecks,
  MessageCircleQuestion,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Square,
  StepForward,
  Undo2,
} from 'lucide-react';
import type {
  Agent,
  AgentId,
  OpenQuestionId,
  SessionId,
  Step,
  WorkflowAutonomy,
  WorkflowRun,
} from '@goodboy/types';
import { isAgentStatusHalted, isAgentStatusSettled } from '@goodboy/core';
import { RUN_AUTONOMY_OPTIONS, runAutonomyOf } from '../../workflows/runAutonomy';
import { skipStepDescription, skipStepTitle } from '../../workflows/skipStepCopy';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/names';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { notifyWorkflowGateBlock } from '../../../store/slices/workflows/notifyWorkflowGateBlock';
import { resolveWorkflowAdvance } from '../../workflows/advanceGate';
import { viewWorkflowAdvance } from '../../workflows/workflowAdvanceView';
import { workflowRunOpenQuestions } from '../../context/openQuestionsGate';
import { isWorkflowRunClosable } from '../../workflows/isWorkflowRunClosable';
import { isWorkflowRunComplete } from '../../workflows/isWorkflowRunComplete';
import { isRunPaused } from '../../workflows/isRunPaused';
import { STEP_ROUTING_REQUEST_EVENT, requestStepRouting } from '../../workflows/requestStepRouting';
import { CLOSE_WORKFLOW_COPY } from '../../workflows/closeWorkflowCopy';
import { useOpenQuestions } from '../../context/components/QuestionsTab/useOpenQuestions';
import type { ActionEnv, ObjectKindDefinition, WorkflowRunActionTarget } from '../types';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
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
  readonly canPause: boolean;
  readonly canResume: boolean;
  readonly hasStepRouting: boolean;
  readonly canSaveAsPreset: boolean;
  readonly summary: string;
  readonly skipStep: SkipStepFacts | null;
  readonly autonomy: WorkflowAutonomy;
};

type SkipStepFacts = {
  readonly agent: Agent;
  readonly number: number;
  readonly description: string;
};

type SkipParams = {
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly steps: ReadonlyArray<Step>;
  readonly stepAgentId: AgentId | null;
};

const skipStepOf = ({ run, agents, steps, stepAgentId }: SkipParams): SkipStepFacts | null => {
  const agent = agents.find((candidate) => candidate.id === stepAgentId) ?? null;
  if (
    agent === null ||
    agent.parentAgentId != null ||
    isAgentStatusSettled({ status: agent.status })
  ) {
    return null;
  }
  const index = [...steps]
    .sort((left, right) => left.ordinal - right.ordinal)
    .findIndex((step) => step.id === agent.stepId);
  if (index < 0) {
    return null;
  }
  return {
    agent,
    number: index + 1,
    description: skipStepDescription({ run, agent, agents }),
  };
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

type RoutingParams = {
  readonly env: ActionEnv;
  readonly facts: WorkflowRunFacts;
};

const showStepRouting = ({ env, facts }: RoutingParams): void => {
  const isViewing = env.viewing?.kind === 'workflowRun' && env.viewing.id === facts.run.id;
  if (isViewing) {
    requestStepRouting({ runId: facts.run.id });
    return;
  }
  openRun({ env, facts });
  dispatchAfterNavigation({
    name: STEP_ROUTING_REQUEST_EVENT,
    detail: { runId: facts.run.id },
  });
};

export const WORKFLOW_RUN_KIND: ObjectKindDefinition<WorkflowRunActionTarget, WorkflowRunFacts> = {
  noun: 'run',
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
    const isOrchestrating = state.orchestratingWorkflowRuns?.[run.id] ?? false;
    const name = run.title ?? workflow?.name ?? 'Run';
    const mounts = state.sessionProjectMounts[target.sessionId] ?? [];
    const runState = runStateOf({
      isDiscarded: run.discardedAt != null,
      isQueued: run.triggerMode !== 'immediate' && agents.length === 0,
      isComplete: isWorkflowRunComplete({ run, workflow, agents }),
      isHalted: agents.some((agent) => isAgentStatusHalted({ status: agent.status })),
      isRunning,
    });
    const isEnded = runState === 'discarded' || runState === 'done';
    const isInFlight = isOrchestrating || agents.some((agent) => agent.status === 'running');
    return {
      run,
      sessionId: target.sessionId,
      name,
      state: runState,
      isClosable: workflow !== null && isWorkflowRunClosable({ run, workflow, agents }),
      openQuestionId: questions[0]?.id ?? null,
      stoppedAgentId: stoppedAgent?.id ?? null,
      readyAgentId: readyAgent?.id ?? null,
      readyStepName: manualStep?.name ?? null,
      hasChanges: mounts.length > 0,
      canPause:
        !isEnded &&
        isInFlight &&
        !isRunPaused({ run }) &&
        run.orchestrationStop?.kind !== 'operator',
      canResume: !isEnded && isRunPaused({ run }),
      hasStepRouting: run.executionMode === 'dynamic' && !isEnded && agents.length > 0,
      canSaveAsPreset: workflow !== null && workflow.steps.length > 0 && workflow.isPreset !== true,
      summary: [name, ...agents.map((agent) => `- ${agent.name}: ${agent.status}`)].join('\n'),
      skipStep: isEnded
        ? null
        : skipStepOf({
            run,
            agents,
            steps: workflow?.steps ?? [],
            stepAgentId: target.stepAgentId ?? null,
          }),
      autonomy: runAutonomyOf({ autoRun: run.autoRun, autonomy: run.rulesSnapshot?.autonomy }).key,
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
        env.getState().navigate({
          to: lensPlace({ state: env.getState(), sessionId: facts.sessionId, lens: 'files' }),
        }),
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
      id: 'workflowRun.pause',
      label: 'Pause run',
      icon: Pause,
      group: 'act',
      when: ({ facts }) => facts.canPause,
      run: ({ facts, env }) => env.getState().pauseWorkflowRun(facts.sessionId, facts.run.id),
    },
    {
      id: 'workflowRun.resume',
      label: 'Resume run',
      icon: Play,
      group: 'act',
      when: ({ facts }) => facts.canResume,
      run: ({ facts, env }) => env.getState().resumeWorkflowRun(facts.sessionId, facts.run.id),
    },
    {
      id: 'workflowRun.skipStep',
      label: ({ facts }) =>
        facts.skipStep === null ? 'Skip step' : `Skip step ${facts.skipStep.number}`,
      icon: SkipForward,
      group: 'act',
      when: ({ facts }) => facts.skipStep !== null,
      confirm: ({ facts }) =>
        facts.skipStep === null
          ? null
          : {
              title: skipStepTitle({ agent: facts.skipStep.agent }),
              description: facts.skipStep.description,
              confirmLabel: 'Skip step',
              role: 'alert',
            },
      run: async ({ facts, env }) => {
        if (facts.skipStep === null) {
          return;
        }
        await env.getState().skipStuckStepAndAdvance(facts.sessionId, facts.run.id, {
          force: true,
          agentId: facts.skipStep.agent.id,
        });
      },
    },
    {
      id: 'workflowRun.routing',
      label: 'Step routing',
      icon: CONCEPT_ICONS.providers,
      group: 'act',
      when: ({ facts }) => facts.hasStepRouting,
      run: ({ facts, env }) => showStepRouting({ env, facts }),
    },
    {
      id: 'workflowRun.autonomy',
      label: NAMES.asksYou,
      icon: SlidersHorizontal,
      group: 'act',
      when: ({ facts }) => isLive({ facts }),
      choices: ({ facts }) =>
        RUN_AUTONOMY_OPTIONS.map((option) => ({
          id: option.key,
          label: option.label,
          detail: option.hint,
          isCurrent: option.key === facts.autonomy,
        })),
      run: async ({ facts, env, choice }) => {
        const picked = RUN_AUTONOMY_OPTIONS.find((option) => option.key === choice);
        if (picked === undefined || picked.key === facts.autonomy) {
          return;
        }
        await env.getState().setWorkflowRunAutonomy(facts.sessionId, facts.run.id, picked.key);
      },
    },
    {
      id: 'workflowRun.saveAsPreset',
      label: 'Save as preset',
      icon: ListChecks,
      group: 'act',
      when: ({ facts }) => facts.canSaveAsPreset,
      pendingLabel: () => 'Saving preset',
      run: async ({ facts, env }) => {
        const preset = await env.getState().saveRunAsPreset({
          sessionId: facts.sessionId,
          workflowRunId: facts.run.id,
        });
        env.showToast({ kind: 'success', message: `Saved ${preset.name} as a preset.` });
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
      icon: Square,
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
      label: NAMES.archiveRun,
      icon: CONCEPT_ICONS.archive,
      group: 'danger',
      when: ({ facts }) => facts.state !== 'discarded',
      confirm: () => ({
        title: 'Archive this run?',
        description:
          'Hides the run, and you can restore it. Agents already started stay in the session.',
        confirmLabel: 'Archive',
        role: 'alert',
      }),
      run: ({ facts, env }) => env.getState().discardWorkflow(facts.sessionId, facts.run.id),
    },
    {
      id: 'workflowRun.delete',
      label: NAMES.deleteRun,
      icon: CONCEPT_ICONS.delete,
      group: 'danger',
      when: () => true,
      confirm: () => ({
        title: 'Delete run?',
        description: 'Permanently removes this run from the session.',
        confirmLabel: 'Delete',
        role: 'danger',
      }),
      run: ({ facts, env }) =>
        env.getState().detachWorkflowFromSession(facts.sessionId, facts.run.id),
    },
  ],
};

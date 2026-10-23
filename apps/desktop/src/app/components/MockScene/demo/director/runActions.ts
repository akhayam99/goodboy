import { brandId, type ProviderRunId, type WorkflowRunId } from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { DirectorStore } from './directorTypes';
import { installDemoWorld } from './installDemoWorld';
import { appendTurnEvents } from './appendTurnEvents';
import { runStepCues, type RunStepRole } from './runStepCues';
import { scheduleCues } from './scheduleCues';
import { startAgentTurn } from './startAgentTurn';

type Params = {
  readonly store: DirectorStore;
};

type RoleParams = {
  readonly kind: string | undefined;
};

const roleOf = ({ kind }: RoleParams): RunStepRole => {
  if (kind === 'implementer') {
    return 'implement';
  }
  if (kind === 'reviewer') {
    return 'review';
  }
  return 'other';
};

type StepParams = {
  readonly store: DirectorStore;
  readonly sessionId: Parameters<AppStore['activateWorkflowAgent']>[0]['sessionId'];
  readonly workflowRunId: WorkflowRunId;
  readonly step: number;
};

const setCurrentStep = ({ store, sessionId, workflowRunId, step }: StepParams): void => {
  store.setState((current) => ({
    sessions: current.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            workflowRuns: session.workflowRuns.map((run) =>
              run.id === workflowRunId
                ? { ...run, currentStep: step, orchestrationStop: undefined }
                : run,
            ),
          }
        : session,
    ),
  }));
};

export const installRunActions = ({ store }: Params): void => {
  installDemoWorld({ store });
  const activateWorkflowAgent: AppStore['activateWorkflowAgent'] = async ({
    sessionId,
    agentId,
    onStarted,
  }) => {
    const state = store.getState();
    const agent = (state.sessionPhaseRuns[sessionId] ?? []).find((entry) => entry.id === agentId);
    if (agent === undefined || state.agentTurnState[agentId]?.kind === 'running') {
      return;
    }
    const runId = brandId<ProviderRunId>({ value: `demo-step-${agentId}-${crypto.randomUUID()}` });
    const at = nowIso({});
    const workflowRunId = agent.workflowRunId;
    if (workflowRunId !== undefined && workflowRunId !== null) {
      setCurrentStep({ store, sessionId, workflowRunId, step: agent.ordinal });
    }
    store.setState((current) => ({
      selectedAgentId: { ...current.selectedAgentId, [sessionId]: agentId },
      agentRunHistory: {
        ...current.agentRunHistory,
        [agentId]: [...(current.agentRunHistory[agentId] ?? []), runId],
      },
    }));
    appendTurnEvents({
      store,
      agentId,
      events: [{ kind: 'user_text', runId, text: agent.name, at }],
    });
    startAgentTurn({ store, sessionId, agentId, runId, at });
    onStarted?.();
    scheduleCues({
      store,
      cues: runStepCues({ sessionId, agentId, runId, role: roleOf({ kind: agent.kind }) }),
      now: () => nowIso({}),
      agentId,
    });
  };
  store.setState({ activateWorkflowAgent });
};

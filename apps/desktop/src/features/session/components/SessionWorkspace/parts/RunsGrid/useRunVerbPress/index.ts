import type { Agent, SessionId } from '@goodboy/types';
import { usePendingAction } from '../../../../../../../shared/hooks/usePendingAction';
import { useAppStore } from '../../../../../../../store';
import { advanceWorkflowAgent } from '../../../../../../workflows/advanceWorkflowAgent';
import type { SessionRun, SessionRunVerb } from '../../../../../sessionRunsOf';

type Params = {
  readonly sessionId: SessionId;
};

type RunParams = {
  readonly run: SessionRun;
};

type VerbParams = {
  readonly verb: SessionRunVerb;
};

type PressSpec = {
  readonly failureTitle: string;
  readonly task: () => Promise<unknown>;
};

export type RunVerbPress = {
  readonly press: (params: RunParams) => void;
  readonly isBusy: (params: RunParams) => boolean;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const useRunVerbPress = ({ sessionId }: Params): RunVerbPress => {
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const retryWorkflowOrchestration = useAppStore((state) => state.retryWorkflowOrchestration);
  const startWorkflowRun = useAppStore((state) => state.startWorkflowRun);
  const activateWorkflowAgent = useAppStore((state) => state.activateWorkflowAgent);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const reportError = useAppStore((state) => state.reportError);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const pending = usePendingAction({ sessionId });

  const specOf = ({ verb }: VerbParams): PressSpec => {
    switch (verb.kind) {
      case 'continue':
        return {
          failureTitle: "Couldn't continue the agent",
          task: () => continueStoppedAgent({ sessionId, agentId: verb.agentId }),
        };
      case 'continueRun':
        return {
          failureTitle: "Couldn't continue the run",
          task: () => retryWorkflowOrchestration(sessionId, verb.runId),
        };
      case 'startRun':
        return {
          failureTitle: "Couldn't start the run",
          task: () => startWorkflowRun(sessionId, verb.runId),
        };
      case 'start':
        return {
          failureTitle: "The next step didn't start",
          task: () =>
            advanceWorkflowAgent({
              sessionId,
              agent: agents.find((candidate) => candidate.id === verb.agentId) ?? null,
              actions: { activateWorkflowAgent, emitNotification, reportError },
            }),
        };
      default: {
        const unreachable: never = verb;
        return unreachable;
      }
    }
  };

  return {
    press: ({ run }) => {
      if (run.verb === null) {
        return;
      }
      void pending.run({ key: run.id, ...specOf({ verb: run.verb }) });
    },
    isBusy: ({ run }) => pending.pendingKeys.has(run.id),
  };
};

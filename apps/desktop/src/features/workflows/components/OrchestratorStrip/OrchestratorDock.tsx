import type { Agent, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { isRunPaused } from '../../isRunPaused';
import { OrchestratorHintComposer } from './OrchestratorHintComposer';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
};

export const OrchestratorDock = ({ sessionId, run, agents }: Props) => {
  const addWorkflowOrchestratorHint = useAppStore((state) => state.addWorkflowOrchestratorHint);
  const reportError = useAppStore((state) => state.reportError);
  const isOrchestrating = useAppStore(
    (state) => state.orchestratingWorkflowRuns?.[run.id] ?? false,
  );

  return (
    <OrchestratorHintComposer
      isDeciding={isOrchestrating}
      isStepRunning={agents.some((agent) => agent.status === 'running')}
      isPaused={isRunPaused({ run })}
      onSubmit={async (draft) => {
        try {
          await addWorkflowOrchestratorHint(sessionId, run.id, draft);
          return true;
        } catch (error) {
          void reportError({ title: "Couldn't save the hint", error, sessionId });
          return false;
        }
      }}
    />
  );
};

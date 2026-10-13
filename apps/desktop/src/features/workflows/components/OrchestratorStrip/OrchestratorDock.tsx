import type { Agent, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { isRunPaused } from '../../isRunPaused';
import { OrchestratorHintComposer } from './OrchestratorHintComposer';
import { OrchestratorQueuedRead } from './OrchestratorQueuedRead';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
};

export const OrchestratorDock = ({ sessionId, run, agents }: Props) => {
  const addWorkflowOrchestratorHint = useAppStore((state) => state.addWorkflowOrchestratorHint);
  const readQueuedWorkflowHints = useAppStore((state) => state.readQueuedWorkflowHints);
  const readingIds = useAppStore((state) => state.orchestratorReadingHints?.[run.id]);
  const reportError = useAppStore((state) => state.reportError);
  const isOrchestrating = useAppStore(
    (state) => state.orchestratingWorkflowRuns?.[run.id] ?? false,
  );
  const isStepRunning = agents.some((agent) => agent.status === 'running');
  const queuedCount = (run.orchestratorHints ?? []).filter(
    (hint) => hint.consumedAt == null && (readingIds ?? []).includes(hint.id) === false,
  ).length;
  const isStopped = run.orchestrationStop?.kind === 'operator';
  const isFinished =
    run.orchestrationOutcome != null &&
    run.orchestrationStop == null &&
    isOrchestrating === false &&
    isStepRunning === false;
  const canRead = run.executionMode === 'dynamic' && (isStopped || isFinished);

  const read = async () => {
    try {
      await readQueuedWorkflowHints({ sessionId, workflowRunId: run.id });
    } catch (error) {
      void reportError({ title: "Couldn't read the queued messages", error, sessionId });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {canRead && queuedCount > 0 ? (
        <OrchestratorQueuedRead
          queuedCount={queuedCount}
          isStopped={isStopped}
          onRead={() => void read()}
        />
      ) : null}
      <OrchestratorHintComposer
        isDeciding={isOrchestrating}
        isStepRunning={isStepRunning}
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
    </div>
  );
};

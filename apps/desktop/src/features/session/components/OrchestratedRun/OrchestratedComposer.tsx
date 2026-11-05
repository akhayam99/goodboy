import type { Agent, OrchestratorHint, SessionId, WorkflowRun } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { OrchestratorHintComposer } from '../../../workflows/components/OrchestratorStrip/OrchestratorHintComposer';
import { OrchestratorRoutingRow } from '../../../workflows/components/OrchestratorStrip/OrchestratorRoutingRow';
import { isRunPaused } from '../../../workflows/isRunPaused';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
};

const NO_HINTS: ReadonlyArray<OrchestratorHint> = [];

export const OrchestratedComposer = ({ sessionId, run, agents }: Props) => {
  const addWorkflowOrchestratorHint = useAppStore((state) => state.addWorkflowOrchestratorHint);
  const reportError = useAppStore((state) => state.reportError);
  const isOrchestrating = useAppStore(
    (state) => state.orchestratingWorkflowRuns?.[run.id] ?? false,
  );
  const draft = useAppStore((state) => state.orchestratorHintDrafts[run.id] ?? '');
  const setOrchestratorHintDraft = useAppStore((state) => state.setOrchestratorHintDraft);
  const restoreOrchestratorHintDraft = useAppStore((state) => state.restoreOrchestratorHintDraft);
  const waitingCount = (run.orchestratorHints ?? NO_HINTS).filter(
    (hint) => hint.consumedAt == null,
  ).length;
  const isStepRunning = agents.some((agent) => agent.status === 'running');

  const viewQueue = () => {
    document.querySelector(`[data-hint-queue="${run.id}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div data-orchestrated-composer="" className="flex min-w-0 flex-col gap-2">
      {waitingCount > 0 ? (
        <p
          data-hint-queue-line=""
          className="flex min-h-6 items-center gap-1 px-2 text-ui text-muted-foreground"
        >
          {ORCHESTRATED_COPY.queuedHintsLine({ count: waitingCount })}
          <Button variant="quiet" size="xs" onClick={viewQueue}>
            {ORCHESTRATED_COPY.queuedHintsView}
          </Button>
        </p>
      ) : null}
      <OrchestratorHintComposer
        isDeciding={isOrchestrating}
        isStepRunning={isStepRunning}
        isPaused={isRunPaused({ run })}
        placeholder={ORCHESTRATED_COPY.composerPlaceholder}
        readNowLabel="Send now"
        draft={draft}
        onDraftChange={(text) => setOrchestratorHintDraft({ workflowRunId: run.id, text })}
        onRestore={(text) => restoreOrchestratorHintDraft({ workflowRunId: run.id, text })}
        footerStart={
          <OrchestratorRoutingRow sessionId={sessionId} run={run} disabled={isOrchestrating} />
        }
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

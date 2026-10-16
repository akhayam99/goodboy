import type { Agent, OrchestratorHint, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { OrchestratorHintComposer } from '../../../workflows/components/OrchestratorStrip/OrchestratorHintComposer';
import { OrchestratorRoutingRow } from '../../../workflows/components/OrchestratorStrip/OrchestratorRoutingRow';
import { isRunPaused } from '../../../workflows/isRunPaused';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { OrchestratedHintChip } from './OrchestratedHintChip';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
};

type RemoveParams = {
  readonly hint: OrchestratorHint;
};

const NO_HINTS: ReadonlyArray<OrchestratorHint> = [];
const NO_READING: ReadonlyArray<string> = [];

export const OrchestratedComposer = ({ sessionId, run, agents }: Props) => {
  const addWorkflowOrchestratorHint = useAppStore((state) => state.addWorkflowOrchestratorHint);
  const removeWorkflowOrchestratorHint = useAppStore(
    (state) => state.removeWorkflowOrchestratorHint,
  );
  const reportError = useAppStore((state) => state.reportError);
  const readingIds = useAppStore((state) => state.orchestratorReadingHints[run.id] ?? NO_READING);
  const isOrchestrating = useAppStore(
    (state) => state.orchestratingWorkflowRuns?.[run.id] ?? false,
  );
  const waiting = (run.orchestratorHints ?? NO_HINTS).filter((hint) => hint.consumedAt == null);
  const isStepRunning = agents.some((agent) => agent.status === 'running');
  const isAnyQueued = waiting.some((hint) => !readingIds.includes(hint.id));

  const remove = async ({ hint }: RemoveParams) => {
    try {
      await removeWorkflowOrchestratorHint(sessionId, run.id, hint.id);
    } catch (error) {
      await reportError({ title: "Couldn't remove the hint", error, sessionId });
    }
  };

  return (
    <div data-orchestrated-composer="" className="flex min-w-0 flex-col gap-2">
      {waiting.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-1">
          {isAnyQueued ? (
            <p data-hint-queue-note="" className="px-2 text-ui text-muted-foreground">
              {ORCHESTRATED_COPY.queuedHintsNote}
            </p>
          ) : null}
          <ul aria-label="Queued hints" className="flex min-w-0 flex-col gap-1">
            {waiting.map((hint) => (
              <OrchestratedHintChip
                key={hint.id}
                hint={hint}
                isReading={readingIds.includes(hint.id)}
                onRemove={() => void remove({ hint })}
              />
            ))}
          </ul>
        </div>
      ) : null}
      <OrchestratorHintComposer
        isDeciding={isOrchestrating}
        isStepRunning={isStepRunning}
        isPaused={isRunPaused({ run })}
        placeholder={ORCHESTRATED_COPY.composerPlaceholder}
        readNowLabel="Send now"
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

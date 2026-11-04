import type { OrchestratorHint, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import type { RailInk } from '../../../workTreeModel/railGeometry';
import { OrchestratedHintRow } from './OrchestratedHintRow';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly slotWidth: number;
  readonly ink: RailInk | null;
  readonly hasLineBelow: boolean;
};

type RemoveParams = {
  readonly hint: OrchestratorHint;
};

const NO_READING: ReadonlyArray<string> = [];

export const OrchestratedQueue = ({
  sessionId,
  run,
  hints,
  slotWidth,
  ink,
  hasLineBelow,
}: Props) => {
  const removeWorkflowOrchestratorHint = useAppStore(
    (state) => state.removeWorkflowOrchestratorHint,
  );
  const reportError = useAppStore((state) => state.reportError);
  const readingIds = useAppStore((state) => state.orchestratorReadingHints[run.id] ?? NO_READING);

  const remove = async ({ hint }: RemoveParams) => {
    try {
      await removeWorkflowOrchestratorHint(sessionId, run.id, hint.id);
    } catch (error) {
      await reportError({ title: "Couldn't remove the hint", error, sessionId });
    }
  };

  if (hints.length === 0) {
    return null;
  }

  return (
    <div data-hint-queue={run.id} className="flex min-w-0 flex-col">
      <div className="flex h-8 min-w-0 items-end">
        <span aria-hidden className="shrink-0" style={{ width: slotWidth }} />
        <p
          data-hint-queue-heading=""
          className="min-w-0 flex-1 truncate px-2 text-ui tabular-nums text-faint-foreground"
        >
          {ORCHESTRATED_COPY.queuedHintsHeading({ count: hints.length })}
        </p>
      </div>
      <ul aria-label="Queued hints" className="flex min-w-0 flex-col">
        {hints.map((hint, index) => (
          <li key={hint.id} className="min-w-0">
            <OrchestratedHintRow
              hint={hint}
              sessionId={sessionId}
              runId={run.id}
              state={readingIds.includes(hint.id) ? 'reading' : 'queued'}
              slotWidth={slotWidth}
              ink={ink}
              hasLineBelow={hasLineBelow || index < hints.length - 1}
              onRemove={() => void remove({ hint })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

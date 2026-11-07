import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import type { OrchestratorHint, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { railThroughOf, type RailInk } from '../../../workTreeModel/railGeometry';
import { TimelineRail } from '../SessionWorkspace/parts/TimelinePane/TimelineRail';
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

const HEADING_HEIGHT = 32;

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
      await reportError({
        recovery: CHECK_STATE,
        title: "Couldn't remove the hint",
        error,
        sessionId,
      });
    }
  };

  if (hints.length === 0) {
    return null;
  }

  return (
    <div data-hint-queue={run.id} className="flex min-w-0 flex-col">
      <div className="flex h-8 min-w-0 items-end">
        <span aria-hidden className="relative h-full shrink-0" style={{ width: slotWidth }}>
          {ink === null ? null : (
            <span data-hint-rail="" className="absolute inset-0">
              <TimelineRail
                rail={railThroughOf({
                  id: `queue-${run.id}`,
                  height: HEADING_HEIGHT,
                  markerY: HEADING_HEIGHT,
                  ink,
                  hasLineBelow: true,
                })}
                width={slotWidth}
              />
            </span>
          )}
        </span>
        <p
          data-hint-queue-heading=""
          className="min-w-0 flex-1 truncate px-2 text-ui text-faint-foreground"
        >
          {ORCHESTRATED_COPY.queuedHintsHeading}
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

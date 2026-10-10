import { useEffect, useState } from 'react';
import { ClampedProse, StatusDot, ToneBar, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type {
  Agent,
  GoalAttachment,
  OrchestratorHint,
  SessionId,
  Step,
  WorkflowRun,
} from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { WorkflowNodeRouting } from '../WorkflowNodeRouting';
import { OrchestratorHintLog } from './OrchestratorHintLog';
import { OrchestratorRoutingRow } from './OrchestratorRoutingRow';
import type { OrchestratorState } from './orchestratorState';
import { StopStepButton } from './StopStepButton';
import { useElapsedLabel } from './useElapsedLabel';
import { STEP_ROUTING_REQUEST_EVENT, isStepRoutingRequest } from '../../requestStepRouting';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly steps: ReadonlyArray<Step>;
  readonly state: OrchestratorState;
  readonly isOrchestrating: boolean;
};

const EMPTY_HINTS: ReadonlyArray<OrchestratorHint> = [];
const EMPTY_READING: ReadonlyArray<string> = [];
const EMPTY_FILES: ReadonlyArray<GoalAttachment> = [];

export const OrchestratorStrip = ({
  sessionId,
  run,
  agents,
  steps,
  state,
  isOrchestrating,
}: Props) => {
  const reportError = useAppStore((store) => store.reportError);
  const removeWorkflowOrchestratorHint = useAppStore(
    (store) => store.removeWorkflowOrchestratorHint,
  );
  const readingHintIds = useAppStore(
    (store) => store.orchestratorReadingHints[run.id] ?? EMPTY_READING,
  );
  const [isRoutingOpen, setIsRoutingOpen] = useState(false);
  const hints = run.orchestratorHints ?? EMPTY_HINTS;
  const runAttachments = useAppStore(
    (store) => store.workflowRunAttachments[run.id] ?? EMPTY_FILES,
  );
  const hasLoadedFiles = useAppStore((store) => store.workflowRunAttachments[run.id] !== undefined);
  const loadGoalAttachments = useAppStore((store) => store.loadGoalAttachments);
  const hasHintFiles = hints.some((hint) => (hint.attachmentIds?.length ?? 0) > 0);

  useEffect(() => {
    if (!hasHintFiles || hasLoadedFiles) {
      return;
    }
    void loadGoalAttachments({ type: 'workflow_run', id: run.id }).catch(() => undefined);
  }, [hasHintFiles, hasLoadedFiles, loadGoalAttachments, run.id]);

  useEffect(() => {
    const onRequest = (event: Event) => {
      if (isStepRoutingRequest({ event, runId: run.id })) {
        setIsRoutingOpen(true);
      }
    };
    window.addEventListener(STEP_ROUTING_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(STEP_ROUTING_REQUEST_EVENT, onRequest);
  }, [run.id]);

  const elapsed = useElapsedLabel({ agentId: state.waitingOnAgentId });
  const isPulsing =
    state.phase === 'deciding' ||
    state.phase === 'automatic' ||
    state.phase === 'stopping' ||
    state.phase === 'plan-revising';
  const pulseTone = state.tone === 'neutral' ? 'info' : state.tone;
  const runningStep =
    agents.find((agent) => agent.parentAgentId == null && agent.status === 'running') ?? null;
  const hasRouting = agents.length > 0;

  return (
    <section
      data-testid="orchestrator-strip"
      data-phase={state.phase}
      aria-label="Orchestrator"
      className="flex min-w-0 flex-col gap-2"
    >
      <div
        data-testid="orchestrator-strip-row"
        className="relative flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border-soft bg-background py-2 pl-4 pr-2"
      >
        <ToneBar tone={state.tone} density="card" />
        <div className="flex min-w-0 max-w-full flex-auto items-center gap-3">
          <span className="flex h-4 shrink-0 items-center" aria-hidden={!isPulsing}>
            {isPulsing ? (
              <StatusDot tone={pulseTone} size="sm" pulsing ariaLabel={state.sentence} />
            ) : (
              <CONCEPT_ICONS.orchestrator
                size={ICON_SIZE.row}
                aria-hidden
                className={
                  state.tone === 'neutral' ? 'text-muted-foreground' : tintClasses(state.tone).icon
                }
              />
            )}
          </span>
          <p className="flex min-w-0 flex-1 items-baseline gap-2">
            <span
              data-testid="orchestrator-state"
              className="min-w-0 truncate text-row text-foreground"
              title={state.sentence}
            >
              {state.sentence}
            </span>
            {elapsed == null ? null : (
              <span
                data-testid="orchestrator-elapsed"
                className="shrink-0 text-meta tabular-nums text-muted-foreground"
              >
                {elapsed}
              </span>
            )}
          </p>
        </div>
        <div
          data-testid="orchestrator-controls"
          className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2"
        >
          {runningStep !== null && state.phase !== 'stopping' ? (
            <StopStepButton sessionId={sessionId} runId={run.id} agent={runningStep} />
          ) : null}
          <OrchestratorRoutingRow sessionId={sessionId} run={run} disabled={isOrchestrating} />
        </div>
        {state.detail != null && state.detail !== '' ? (
          <div data-testid="orchestrator-detail" className="min-w-0 basis-full">
            <ClampedProse
              text={state.detail}
              lines={2}
              className="text-meta leading-relaxed text-muted-foreground"
            />
          </div>
        ) : null}
      </div>

      <OrchestratorHintLog
        hints={hints}
        readingHintIds={readingHintIds}
        runAttachments={runAttachments}
        onRemove={(hintId) =>
          void removeWorkflowOrchestratorHint(sessionId, run.id, hintId).catch((error: unknown) =>
            reportError({ title: "Couldn't remove the hint", error, sessionId }),
          )
        }
      />

      {isRoutingOpen && hasRouting ? (
        <WorkflowNodeRouting
          sessionId={sessionId}
          workflowRunId={run.id}
          steps={steps}
          onClose={() => setIsRoutingOpen(false)}
        />
      ) : null}
    </section>
  );
};

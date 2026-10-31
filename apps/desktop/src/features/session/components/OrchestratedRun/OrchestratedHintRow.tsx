import { useId, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import {
  Button,
  Markdown,
  StatusDot,
  Tooltip,
  WORK_NODE_GLYPH_SIZE,
  WorkNode,
  inlineMarkdownText,
} from '@goodboy/ui';
import type { OrchestratorHint, SessionId, WorkflowRunId } from '@goodboy/types';
import { hintIsLong } from '../../../workflows/hintIsLong';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { AttachmentStrip } from '../../../attachments/components/AttachmentStrip';
import { OrchestratedPlanSlot } from './OrchestratedPlanSlot';
import { useHintImageItems } from './useHintImageItems';

type OrchestratedHintState = 'read' | 'queued' | 'reading';

type Props = {
  readonly hint: OrchestratorHint;
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly state: OrchestratedHintState;
  readonly slotWidth: number;
  readonly onOpenStep?: (() => void) | null;
  readonly onRemove?: () => void;
};

const NODE_TONE = {
  read: 'neutral',
  queued: 'neutral',
  reading: 'info',
} as const satisfies Record<OrchestratedHintState, 'neutral' | 'info'>;

export const OrchestratedHintRow = ({
  hint,
  sessionId,
  runId,
  state,
  slotWidth,
  onOpenStep = null,
  onRemove,
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const bodyId = useId();
  const images = useHintImageItems({ sessionId, runId, hint });
  const isLong = hintIsLong({ text: hint.text });
  const first = hint.text.split('\n').find((line) => line.trim() !== '') ?? hint.text;
  const isReading = state === 'reading';
  const remove =
    onRemove === undefined ? null : (
      <Button variant="quiet" size="xs" disabled={isReading} onClick={onRemove}>
        Remove
      </Button>
    );
  const step =
    state === 'read' && hint.consumedAtStep != null ? (
      onOpenStep === null ? (
        <span className="shrink-0 text-faint-foreground">
          {ORCHESTRATED_COPY.readHint({ step: hint.consumedAtStep })}
        </span>
      ) : (
        <Button
          variant="quiet"
          size="xs"
          className="shrink-0"
          onClick={onOpenStep}
          data-hint-step-link=""
        >
          {ORCHESTRATED_COPY.readHint({ step: hint.consumedAtStep })}
        </Button>
      )
    ) : null;

  return (
    <div data-hint-chip={state} data-plan-row="hint" className="flex min-w-0 flex-col gap-1">
      <div className="flex h-8 min-w-0 items-center">
        <OrchestratedPlanSlot slotWidth={slotWidth}>
          <WorkNode
            state={state === 'queued' ? 'queued' : 'marker'}
            tone={NODE_TONE[state]}
            label={ORCHESTRATED_COPY.hintNode}
            mark={{
              kind: 'glyph',
              glyph: (
                <MessageSquareText
                  size={WORK_NODE_GLYPH_SIZE}
                  strokeWidth={2}
                  className="text-muted-foreground"
                />
              ),
            }}
          />
        </OrchestratedPlanSlot>
        <span className="flex min-w-0 flex-1 items-center gap-2 px-2 text-ui">
          {isExpanded ? (
            <span className="flex-1" />
          ) : (
            <span data-hint-text="" className="min-w-0 flex-1 truncate text-foreground">
              {inlineMarkdownText({ text: first })}
            </span>
          )}
          {isLong ? (
            <Button
              variant="quiet"
              size="xs"
              className="shrink-0"
              aria-expanded={isExpanded}
              aria-controls={bodyId}
              onClick={() => setIsExpanded((isOpen) => !isOpen)}
            >
              {isExpanded ? ORCHESTRATED_COPY.hintLess : ORCHESTRATED_COPY.hintMore}
            </Button>
          ) : null}
          {step}
          {isReading ? (
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
              <StatusDot tone="info" size="sm" pulsing />
              {ORCHESTRATED_COPY.hintReading}
            </span>
          ) : null}
          {isReading && remove !== null ? (
            <Tooltip content="The orchestrator is reading it now" side="top">
              <span className="inline-flex">{remove}</span>
            </Tooltip>
          ) : (
            remove
          )}
        </span>
      </div>
      {isExpanded ? (
        <div className="flex min-w-0">
          <span aria-hidden className="shrink-0" style={{ width: slotWidth }} />
          <div id={bodyId} data-hint-body="" className="min-w-0 flex-1 px-2">
            <Markdown text={hint.text} className="text-ui text-foreground" />
          </div>
        </div>
      ) : null}
      {images.length > 0 ? (
        <div className="flex min-w-0">
          <span aria-hidden className="shrink-0" style={{ width: slotWidth }} />
          <div data-hint-images="" className="min-w-0 flex-1 px-2">
            <AttachmentStrip items={images} railLabel={ORCHESTRATED_COPY.hintImages} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

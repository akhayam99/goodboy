import { useId } from 'react';
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
import { AttachmentStrip } from '../../../attachments/AttachmentStrip';
import { OrchestratedPlanSlot } from './OrchestratedPlanSlot';
import { useHintImageItems } from './useHintImageItems';
import { useHintRowState } from './useHintRowState';
import { useIsClipped } from './useIsClipped';

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

const NAMED_HINT_CHARS = 60;

export const OrchestratedHintRow = ({
  hint,
  sessionId,
  runId,
  state,
  slotWidth,
  onOpenStep = null,
  onRemove,
}: Props) => {
  const { rowRef, isExpanded, openImageId, setIsExpanded, setOpenImageId } = useHintRowState({
    runId,
    hintId: hint.id,
  });
  const bodyId = useId();
  const { images, hasFailed, retry } = useHintImageItems({ sessionId, runId, hint });
  const { ref: textRef, isClipped } = useIsClipped();
  const canToggle = hintIsLong({ text: hint.text, isClipped }) || isExpanded;
  const first = hint.text.split('\n').find((line) => line.trim() !== '') ?? hint.text;
  const named = first.length > NAMED_HINT_CHARS ? `${first.slice(0, NAMED_HINT_CHARS)}...` : first;
  const isReading = state === 'reading';
  const remove =
    onRemove === undefined ? null : (
      <Button
        variant="quiet"
        size="xs"
        disabled={isReading}
        onClick={onRemove}
        data-hint-control="remove"
      >
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
          data-hint-control="step"
        >
          {ORCHESTRATED_COPY.readHint({ step: hint.consumedAtStep })}
        </Button>
      )
    ) : null;

  return (
    <div
      ref={rowRef}
      data-hint-chip={state}
      data-plan-row="hint"
      className="flex min-w-0 flex-col gap-1"
    >
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
          <span className="sr-only">
            {state === 'queued' ? ORCHESTRATED_COPY.hintQueued : ORCHESTRATED_COPY.hintNode}
          </span>
          {isExpanded ? (
            <span className="flex-1" />
          ) : (
            <span
              ref={textRef}
              data-hint-text=""
              className="min-w-0 flex-1 truncate text-foreground"
            >
              {inlineMarkdownText({ text: first })}
            </span>
          )}
          {canToggle ? (
            <Button
              variant="quiet"
              size="xs"
              className="shrink-0"
              aria-expanded={isExpanded}
              aria-controls={bodyId}
              aria-label={
                isExpanded
                  ? ORCHESTRATED_COPY.hintLessNamed({ hint: named })
                  : ORCHESTRATED_COPY.hintMoreNamed({ hint: named })
              }
              data-hint-control="toggle"
              onClick={() => setIsExpanded({ isExpanded: !isExpanded })}
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
      <div hidden={!isExpanded} className={isExpanded ? 'flex min-w-0' : 'hidden'}>
        <span aria-hidden className="shrink-0" style={{ width: slotWidth }} />
        <div id={bodyId} data-hint-body="" className="min-w-0 flex-1 px-2">
          {isExpanded ? <Markdown text={hint.text} className="text-ui text-foreground" /> : null}
        </div>
      </div>
      {images.length > 0 ? (
        <div className="flex min-w-0">
          <span aria-hidden className="shrink-0" style={{ width: slotWidth }} />
          <div data-hint-images="" className="min-w-0 flex-1 px-2">
            <AttachmentStrip
              items={images}
              railLabel={ORCHESTRATED_COPY.hintImages}
              viewer={{
                openId: openImageId,
                onOpenChange: setOpenImageId,
              }}
            />
          </div>
        </div>
      ) : null}
      {hasFailed ? (
        <div className="flex min-w-0">
          <span aria-hidden className="shrink-0" style={{ width: slotWidth }} />
          <p
            data-hint-images-failed=""
            className="flex min-w-0 flex-1 items-center gap-2 px-2 text-meta text-muted-foreground"
          >
            {ORCHESTRATED_COPY.hintImagesFailed}
            <Button variant="quiet" size="xs" onClick={retry}>
              {ORCHESTRATED_COPY.hintImagesRetry}
            </Button>
          </p>
        </div>
      ) : null}
    </div>
  );
};

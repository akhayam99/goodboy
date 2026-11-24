import { useId } from 'react';
import { MessageSquareText } from '@goodboy/ui/icons';
import {
  ActivityMessage,
  Button,
  ICON_SIZE,
  Markdown,
  Tooltip,
  WorkNode,
  inlineMarkdownText,
} from '@goodboy/ui';
import type { OrchestratorHint, SessionId, WorkflowRunId } from '@goodboy/types';
import { hintIsLong } from '../../../workflows/hintIsLong';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { AttachmentStrip } from '../../../attachments/AttachmentStrip';
import { OrchestratedHintByline } from './OrchestratedHintByline';
import { OrchestratedPlanSlot } from './OrchestratedPlanSlot';
import { useHintImageItems } from './useHintImageItems';
import { useHintRowState } from './useHintRowState';
import { useMeasuredNode } from './useMeasuredNode';
import { TimelineRail } from '../SessionWorkspace/parts/TimelinePane/TimelineRail';
import { railThroughOf, type RailInk } from '../../../workTreeModel/railGeometry';

type OrchestratedHintState = 'read' | 'queued' | 'reading';

type Props = {
  readonly hint: OrchestratorHint;
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly state: OrchestratedHintState;
  readonly slotWidth: number;
  readonly ink?: RailInk | null;
  readonly hasLineBelow?: boolean;
  readonly onOpenStep?: (() => void) | null;
  readonly onRemove?: () => void;
};

const NODE_TONE = {
  read: 'neutral',
  queued: 'neutral',
  reading: 'info',
} as const satisfies Record<OrchestratedHintState, 'neutral' | 'info'>;

const NAMED_HINT_CHARS = 60;

const HINT_MARKER_Y = 16;

type NodeParams = {
  readonly node: HTMLElement;
};

const offsetHeightOf = ({ node }: NodeParams): number => node.offsetHeight;

const BUBBLE = '[data-activity-message-bubble]';

const FENCE = /^\s*(```|~~~)/;

const isClippedNode = ({ node }: NodeParams): boolean => {
  const bubble = node.querySelector<HTMLElement>(BUBBLE);
  return bubble !== null && bubble.scrollWidth > bubble.clientWidth;
};

export const OrchestratedHintRow = ({
  hint,
  sessionId,
  runId,
  state,
  slotWidth,
  ink = null,
  hasLineBelow = false,
  onOpenStep = null,
  onRemove,
}: Props) => {
  const { ref: railRef, value: railHeight } = useMeasuredNode({
    measure: offsetHeightOf,
    initial: 0,
  });
  const { rowRef, isExpanded, openImageId, setIsExpanded, setOpenImageId } = useHintRowState({
    runId,
    hintId: hint.id,
  });
  const bodyId = useId();
  const { images, hasFailed, retry } = useHintImageItems({ sessionId, runId, hint });
  const { ref: textRef, value: isClipped } = useMeasuredNode({
    measure: isClippedNode,
    initial: false,
  });
  const canToggle = hintIsLong({ text: hint.text, isClipped }) || isExpanded;
  const first = hint.text.split('\n').find((line) => line.trim() !== '') ?? hint.text;
  const rest = FENCE.test(first)
    ? ''
    : hint.text.slice(hint.text.indexOf(first) + first.length).trim();
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
  const toggle = canToggle ? (
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
  ) : null;

  return (
    <div
      ref={rowRef}
      data-hint-chip={state}
      data-plan-row="hint"
      className="relative flex min-w-0 flex-col gap-1"
    >
      {ink === null ? null : (
        <span
          ref={railRef}
          aria-hidden
          data-hint-rail=""
          className="absolute inset-y-0 left-0"
          style={{ width: slotWidth }}
        >
          <TimelineRail
            rail={railThroughOf({
              id: hint.id,
              height: railHeight,
              markerY: HINT_MARKER_Y,
              ink,
              hasLineBelow,
            })}
            width={slotWidth}
          />
        </span>
      )}
      <div className="flex h-8 min-w-0 items-center">
        <OrchestratedPlanSlot slotWidth={slotWidth}>
          <WorkNode
            look="quiet"
            size="sm"
            state="marker"
            tone={NODE_TONE[state]}
            label={ORCHESTRATED_COPY.hintNode}
            mark={{
              kind: 'glyph',
              glyph: <MessageSquareText size={ICON_SIZE.mark} className="text-muted-foreground" />,
            }}
          />
        </OrchestratedPlanSlot>
        <span className="sr-only">
          {state === 'queued' ? ORCHESTRATED_COPY.hintQueued : ORCHESTRATED_COPY.hintNode}
        </span>
        <div ref={textRef} data-hint-message="" className="flex h-full min-w-0 flex-1">
          <ActivityMessage
            density="feed"
            text={inlineMarkdownText({ text: first })}
            isPending={state !== 'read'}
            byline={
              <OrchestratedHintByline
                state={state}
                step={hint.consumedAtStep ?? null}
                onOpenStep={onOpenStep}
              />
            }
            actions={
              <>
                {toggle}
                {images.length > 0 ? (
                  <span data-hint-images="" className="flex shrink-0">
                    <AttachmentStrip
                      items={images}
                      railLabel={ORCHESTRATED_COPY.hintImages}
                      size="compact"
                      viewer={{
                        openId: openImageId,
                        onOpenChange: setOpenImageId,
                      }}
                    />
                  </span>
                ) : null}
                {isReading && remove !== null ? (
                  <Tooltip content="The orchestrator is reading it now" side="top">
                    <span className="inline-flex">{remove}</span>
                  </Tooltip>
                ) : (
                  remove
                )}
              </>
            }
          />
        </div>
      </div>
      <div hidden={!isExpanded} className={isExpanded ? 'flex min-w-0' : 'hidden'}>
        <span aria-hidden className="shrink-0" style={{ width: slotWidth }} />
        <div id={bodyId} data-hint-body="" className="min-w-0 flex-1 pl-3 pr-2">
          {isExpanded ? (
            <Markdown text={rest === '' ? hint.text : rest} className="text-ui text-foreground" />
          ) : null}
        </div>
      </div>
      {hasFailed ? (
        <div className="flex min-w-0">
          <span aria-hidden className="shrink-0" style={{ width: slotWidth }} />
          <p
            data-hint-images-failed=""
            className="flex min-w-0 flex-1 items-center gap-2 pl-3 pr-2 text-meta text-muted-foreground"
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

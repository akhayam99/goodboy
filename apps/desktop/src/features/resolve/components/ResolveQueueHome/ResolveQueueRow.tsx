import { ChevronRight, RotateCcw } from 'lucide-react';
import {
  CardAction,
  CardActionSlot,
  Chip,
  ClampedProse,
  InteractiveRow,
  Tooltip,
  cn,
} from '@goodboy/ui';
import { formatAbsoluteDateTime, formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { stripInlineMarkdown } from '../../../../shared/components/InlineMarkdown/stripInlineMarkdown';
import { RESOLVE_COMMENT_UNAVAILABLE, RESOLVE_QUEUE_ACTION_LABEL } from '../../resolveQueueCopy';
import { deliverySupportLine } from '../../resolveDeliverySupport';
import { heldBackChipLabel } from '../../resolvePublishCopy';
import type { HeldBackKind } from '../../heldBackByThreadId';
import { shortSha } from '../../resolveItemCopy';
import type { ResolveQueueRow as QueueRow } from '../../buildResolveQueueRows';
import { ResolveStatusBadge } from '../ResolveStatusBadge';

type Props = {
  readonly row: QueueRow;
  readonly isSelected: boolean;
  readonly heldBack: HeldBackKind | null;
  readonly onOpen: () => void;
  readonly onResume: () => void;
  readonly onOpenCommit: (params: { readonly sha: string }) => void;
};

const deliveryTimeMs = ({ row }: { readonly row: QueueRow }): number | null =>
  row.delivery === null ? null : (row.delivery.replyPostedAt ?? row.delivery.resolvedAt);

export const ResolveQueueRow = ({
  row,
  isSelected,
  heldBack,
  onOpen,
  onResume,
  onOpenCommit,
}: Props) => {
  const { status, reviewerNote, item } = row;
  const body = reviewerNote?.body ?? null;
  const accessibleName =
    body === null ? RESOLVE_COMMENT_UNAVAILABLE : stripInlineMarkdown({ text: body });
  const support = deliverySupportLine({ row });
  const integratedSha = item.integratedSha;
  const postedAtMs = deliveryTimeMs({ row });

  return (
    <li className="list-none">
      <InteractiveRow
        label={accessibleName}
        isSelected={isSelected}
        onOpen={onOpen}
        dataAttributes={{ 'data-thread-id': row.thread.threadId }}
        frameClassName={cn(
          'group/resolve-row',
          status === 'working' && 'spin-border spin-border-info',
        )}
        className="grid grid-cols-[minmax(0,1fr)_auto_auto] grid-rows-[auto_auto] gap-x-4 gap-y-2 px-3 py-2 text-left"
      >
        <div className="col-start-1 row-start-1 min-w-0">
          {body === null ? (
            <p className="text-sm font-medium leading-5 text-muted-foreground">
              {RESOLVE_COMMENT_UNAVAILABLE}
            </p>
          ) : (
            <div className="min-w-0 text-sm font-medium leading-5 text-foreground">
              <ClampedProse text={body} lines={2} className="text-foreground" />
            </div>
          )}
        </div>
        <div className="col-start-2 row-start-1 self-start">
          <ResolveStatusBadge status={status} width="lg" bordered={isSelected} />
        </div>
        <CardActionSlot
          label={RESOLVE_QUEUE_ACTION_LABEL.openComment}
          className="col-start-3 row-start-1 self-start"
        >
          <CardAction
            icon={ChevronRight}
            label={RESOLVE_QUEUE_ACTION_LABEL.openComment}
            onClick={onOpen}
          />
        </CardActionSlot>
        <span className="col-start-1 row-start-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-3xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2">
            {reviewerNote?.author != null && (
              <span className="shrink-0 truncate">{reviewerNote.author}</span>
            )}
            {reviewerNote?.location != null && (
              <span className="min-w-0 truncate font-mono">{reviewerNote.location}</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {integratedSha !== null && (
              <Tooltip content={integratedSha} side="top">
                <button
                  type="button"
                  onClick={() => onOpenCommit({ sha: integratedSha })}
                  className="rounded-sm font-mono tabular-nums underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {shortSha({ sha: integratedSha })}
                </button>
              </Tooltip>
            )}
            {postedAtMs !== null && (
              <Tooltip
                content={formatAbsoluteDateTime({ iso: new Date(postedAtMs).toISOString() })}
                side="top"
              >
                <span className="tabular-nums">
                  {formatRelativeAge({ fromIso: new Date(postedAtMs).toISOString() })}
                </span>
              </Tooltip>
            )}
          </span>
        </span>
        <span className="col-start-2 row-start-2 flex items-center justify-end gap-2 self-start text-right text-2xs text-muted-foreground">
          {heldBack !== null && (
            <Chip
              size="3xs"
              tone="warning"
              bordered={false}
              label={heldBackChipLabel({ kind: heldBack })}
            />
          )}
          {support}
        </span>
        {status === 'later' && (
          <CardActionSlot
            label="Comment lifecycle actions"
            className="col-start-3 row-start-2 self-end"
          >
            <CardAction
              icon={RotateCcw}
              label={RESOLVE_QUEUE_ACTION_LABEL.resume}
              onClick={onResume}
            />
          </CardActionSlot>
        )}
      </InteractiveRow>
    </li>
  );
};

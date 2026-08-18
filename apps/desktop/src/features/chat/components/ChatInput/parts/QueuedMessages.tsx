import { Clock, Paperclip, X } from 'lucide-react';
import { RoutingBadge } from '../../../../../shared/components/RoutingBadge';
import type { QueuedTurn } from '../lib';
import { Tooltip } from '@goodboy/ui';

type QueuedItem = Pick<QueuedTurn, 'id' | 'content' | 'attachments' | 'override'>;

export const QueuedMessages = ({
  items,
  canEdit,
  onEdit,
  onRemove,
}: {
  readonly items: ReadonlyArray<QueuedItem>;
  readonly canEdit: boolean;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
}) => {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1 rounded-md bg-subtle/80 p-1 ring-1 ring-border-soft">
      <div className="flex items-center gap-1.5 px-1.5 pt-0.5 text-2xs text-muted-foreground">
        <Clock size={11} aria-hidden />
        <span>
          {items.length === 1
            ? 'queued, sends when the current turn finishes'
            : `${items.length} queued, send in order`}
        </span>
      </div>
      {items.map((item, i) => {
        const trimmed = item.content.trim();
        const attachmentCount = item.attachments.length;
        const preview =
          trimmed.length > 0
            ? trimmed
            : `${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`;
        return (
          <div
            key={item.id}
            className="group flex items-center gap-2 rounded-md bg-background/60 px-1.5 py-1"
          >
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-2xs font-medium text-primary">
              {i + 1}
            </span>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onEdit(item.id)}
              title={canEdit ? 'Edit, moves it back to the composer' : 'Clear the composer to edit'}
              className="min-w-0 flex-1 truncate text-left text-xs text-foreground/80 transition-colors enabled:hover:text-foreground disabled:cursor-default"
            >
              {preview}
            </button>
            {item.override != null && (
              <RoutingBadge
                provider={item.override.providerId}
                model={item.override.model ?? item.override.selection?.key}
                effort={item.override.selection?.effort}
                muted
                className="max-w-40 shrink-0"
              />
            )}
            {attachmentCount > 0 && trimmed.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-2xs text-muted-foreground">
                <Paperclip size={10} aria-hidden />
                {attachmentCount}
              </span>
            )}
            <Tooltip content="Remove from queue">
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label="Remove from queue"
                className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <X size={11} aria-hidden />
              </button>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
};

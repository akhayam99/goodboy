import { Paperclip, X } from 'lucide-react';
import { Button, IconButton, StatusDot, cn, tintClasses } from '@goodboy/ui';
import { RoutingLabel } from '../../../../../shared/components/RoutingLabel';
import type {
  AgentQueuedStatus,
  AgentQueuedTurn,
} from '../../../../../store/slices/agentQueue/types';

type QueuedItem = Pick<AgentQueuedTurn, 'id' | 'content' | 'attachments' | 'override' | 'status'>;

type Props = {
  readonly items: ReadonlyArray<QueuedItem>;
  readonly canEdit: boolean;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onSendNow: (id: string) => void;
};

const ROW_CLASSES: Record<AgentQueuedStatus, string> = {
  queued: cn('border-dashed', tintClasses('warning').border),
  sending: tintClasses('info').border,
};

const previewOf = ({ item }: { readonly item: QueuedItem }): string => {
  const trimmed = item.content.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  const count = item.attachments.length;
  return `${count} attachment${count === 1 ? '' : 's'}`;
};

export const QueuedMessages = ({ items, canEdit, onEdit, onRemove, onSendNow }: Props) => {
  if (items.length === 0) {
    return null;
  }
  const isHandingOff = items.some((item) => item.status === 'sending');
  return (
    <ul aria-label="Queued messages" className="flex flex-col gap-1">
      {items.map((item) => {
        const isSending = item.status === 'sending';
        const attachmentCount = item.attachments.length;
        return (
          <li
            key={item.id}
            data-testid="queued-message-row"
            data-status={item.status}
            className={cn(
              'flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-secondary',
              ROW_CLASSES[item.status],
            )}
          >
            {isSending ? <StatusDot tone="info" size="sm" pulsing /> : null}
            <button
              type="button"
              disabled={!canEdit || isSending}
              onClick={() => onEdit(item.id)}
              title={
                isSending
                  ? undefined
                  : canEdit
                    ? 'Edit, moves it back to the composer'
                    : 'Clear the composer to edit'
              }
              className="min-w-0 flex-1 truncate text-left text-xs leading-relaxed text-foreground disabled:cursor-default"
            >
              {previewOf({ item })}
            </button>
            {item.override != null && (
              <RoutingLabel
                provider={item.override.providerId}
                model={item.override.model ?? item.override.selection?.key}
                effort={item.override.selection?.effort}
                className="max-w-40 shrink-0"
              />
            )}
            {attachmentCount > 0 && item.content.trim().length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-muted-foreground">
                <Paperclip size={10} aria-hidden />
                {attachmentCount}
              </span>
            )}
            <span
              data-testid="queued-message-status"
              className={cn('shrink-0 leading-relaxed', isSending ? 'text-info' : 'text-warning')}
            >
              {isSending ? 'Sending now' : 'Waits for this turn'}
            </span>
            {isSending ? null : (
              <Button
                variant="ghost"
                size="sm"
                disabled={isHandingOff}
                onClick={() => onSendNow(item.id)}
              >
                Send now
              </Button>
            )}
            <IconButton
              icon={X}
              label="Remove from queue"
              tooltip={isSending ? 'Sending it now' : 'Remove from queue'}
              variant="ghost"
              iconSize={11}
              disabled={isSending}
              onClick={() => onRemove(item.id)}
            />
          </li>
        );
      })}
    </ul>
  );
};

import { X } from 'lucide-react';
import {
  Button,
  cn,
  ICON_SIZE,
  IconButton,
  Notice,
  StatusDot,
  tintClasses,
  Tooltip,
} from '@goodboy/ui';
import { RoutingLabel } from '../../../../../shared/components/RoutingLabel';
import { countNoun } from '../../../../../shared/utils/countNoun';
import { AttachmentStrip } from '../../../../attachments/AttachmentStrip';
import type { PendingMessageAction } from '../../../../auto/chat/pendingMessageOf';
import type { QueuedRow, QueuedRowStatus } from '../queuedRowsOf';

type Failure = Readonly<{
  title: string;
  message: string;
}>;

type Props = {
  readonly items: ReadonlyArray<QueuedRow>;
  readonly canEdit: boolean;
  readonly failure?: Failure | null;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onSendNow: (id: string) => void;
  readonly onRetry?: (id: string) => void;
  readonly onRaiseLimit?: (id: string) => void;
};

const ROW_CLASSES: Record<QueuedRowStatus, string> = {
  queued: cn('border-dashed', tintClasses('warning').border),
  waits: cn('border-dashed', tintClasses('warning').border),
  sending: tintClasses('info').border,
  notDelivered: tintClasses('danger').border,
};

const STATUS_CLASSES: Record<QueuedRowStatus, string> = {
  queued: 'text-warning',
  waits: 'text-warning',
  sending: 'text-info',
  notDelivered: 'text-danger',
};

const ACTION_LABEL: Readonly<Record<PendingMessageAction, string>> = {
  sendNow: 'Send now',
  raiseLimit: 'Change limit',
  retry: 'Retry',
};

type PreviewParams = {
  readonly item: QueuedRow;
};

const previewOf = ({ item }: PreviewParams): string => {
  const trimmed = item.content.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  return countNoun({ count: item.imageCount, one: 'attachment' });
};

type ActParams = {
  readonly id: string;
  readonly action: PendingMessageAction;
};

type ActionOfParams = {
  readonly item: QueuedRow;
};

const actionOf = ({ item }: ActionOfParams): PendingMessageAction | null => {
  if (item.source === 'agent') {
    return item.status === 'sending' ? null : 'sendNow';
  }
  return item.action;
};

export const QueuedMessages = ({
  items,
  canEdit,
  failure = null,
  onEdit,
  onRemove,
  onSendNow,
  onRetry,
  onRaiseLimit,
}: Props) => {
  if (items.length === 0) {
    return null;
  }
  const isHandingOff = items.some((item) => item.status === 'sending');
  const act = ({ id, action }: ActParams) => {
    if (action === 'sendNow') {
      onSendNow(id);
      return;
    }
    if (action === 'retry') {
      onRetry?.(id);
      return;
    }
    onRaiseLimit?.(id);
  };
  return (
    <div className="flex flex-col gap-1">
      <ul aria-label="Queued messages" className="flex flex-col gap-1">
        {items.map((item) => {
          const isSending = item.status === 'sending';
          const action = actionOf({ item });
          return (
            <li
              key={item.id}
              data-testid="queued-message-row"
              data-status={item.status}
              data-source={item.source}
              className={cn(
                'flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-chip',
                ROW_CLASSES[item.status],
              )}
            >
              {isSending ? <StatusDot tone="info" size="sm" pulsing /> : null}
              <Tooltip
                content={
                  isSending
                    ? undefined
                    : canEdit
                      ? 'Edit, moves it back to the composer'
                      : 'Clear the composer to edit'
                }
                anchorClassName="min-w-0 flex-1"
              >
                <button
                  type="button"
                  disabled={!canEdit || isSending}
                  onClick={() => onEdit(item.id)}
                  className="min-w-0 flex-1 truncate text-left text-meta leading-relaxed text-foreground disabled:cursor-default"
                >
                  {previewOf({ item })}
                </button>
              </Tooltip>
              {item.override != null && (
                <RoutingLabel
                  provider={item.override.providerId}
                  model={item.override.model ?? item.override.selection?.key}
                  effort={item.override.selection?.effort}
                  className="max-w-40 shrink-0"
                />
              )}
              {item.images.length > 0 && (
                <div data-testid="queued-message-images" className="shrink-0">
                  <AttachmentStrip
                    items={item.images}
                    railLabel="Images in this message"
                    size="compact"
                    isEnd
                  />
                </div>
              )}
              <Tooltip content={item.reason ?? undefined}>
                <span
                  data-testid="queued-message-status"
                  className={cn('shrink-0 leading-relaxed', STATUS_CLASSES[item.status])}
                >
                  {item.statusText}
                </span>
              </Tooltip>
              {action === null ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={action === 'sendNow' && isHandingOff}
                  onClick={() => act({ id: item.id, action })}
                >
                  {ACTION_LABEL[action]}
                </Button>
              )}
              <IconButton
                icon={X}
                label="Remove from queue"
                tooltip={isSending ? 'Sending it now' : 'Remove from queue'}
                variant="ghost"
                iconSize={ICON_SIZE.row}
                disabled={isSending}
                onClick={() => onRemove(item.id)}
              />
            </li>
          );
        })}
      </ul>
      {failure === null ? null : (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={failure.title}
          body={failure.message}
        />
      )}
    </div>
  );
};

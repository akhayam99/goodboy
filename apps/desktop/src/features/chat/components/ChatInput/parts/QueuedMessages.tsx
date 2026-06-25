import { Clock, Paperclip, X } from 'lucide-react'
import type { PendingAttachment } from '../lib'

type QueuedItem = {
  readonly id: string
  readonly content: string
  readonly attachments: ReadonlyArray<PendingAttachment>
}

export function QueuedMessages({
  items,
  canEdit,
  onEdit,
  onRemove,
}: {
  readonly items: ReadonlyArray<QueuedItem>
  readonly canEdit: boolean
  readonly onEdit: (id: string) => void
  readonly onRemove: (id: string) => void
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-1 rounded-[6px] bg-subtle/80 p-1 ring-1 ring-border-soft">
      <div className="flex items-center gap-1.5 px-1.5 pt-0.5 text-2xs text-muted-foreground">
        <Clock size={11} aria-hidden />
        <span>
          {items.length === 1
            ? 'queued, sends when the current turn finishes'
            : `${items.length} queued, send in order`}
        </span>
      </div>
      {items.map((item, i) => {
        const trimmed = item.content.trim()
        const attachmentCount = item.attachments.length
        const preview =
          trimmed.length > 0
            ? trimmed
            : `${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`
        return (
          <div
            key={item.id}
            className="group flex items-center gap-2 rounded bg-background/60 px-1.5 py-1"
          >
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-2xs font-medium text-primary">
              {i + 1}
            </span>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onEdit(item.id)}
              title={canEdit ? 'edit, moves it back to the composer' : 'clear the composer to edit'}
              className="min-w-0 flex-1 truncate text-left text-xs text-foreground/80 transition-colors enabled:hover:text-foreground disabled:cursor-default"
            >
              {preview}
            </button>
            {attachmentCount > 0 && trimmed.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-2xs text-muted-foreground">
                <Paperclip size={10} aria-hidden />
                {attachmentCount}
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              title="remove from queue"
              aria-label="remove queued message"
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <X size={11} aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}

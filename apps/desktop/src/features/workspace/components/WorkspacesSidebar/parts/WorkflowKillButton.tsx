import { useState } from 'react'
import { Ban, Check, X } from 'lucide-react'

export function WorkflowKillButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm">
        <span className="px-0.5 text-2xs text-muted-foreground">Discard?</span>
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
            onConfirm()
          }}
          title="confirm discard"
          aria-label="confirm discard workflow"
          className="rounded p-0.5 text-danger transition-colors hover:bg-danger/10"
        >
          <Check size={12} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          title="cancel"
          aria-label="cancel discard workflow"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <X size={12} aria-hidden />
        </button>
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title="discard workflow"
      aria-label="discard workflow"
      className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-danger/10 hover:text-danger"
    >
      <Ban size={11} aria-hidden />
    </button>
  )
}

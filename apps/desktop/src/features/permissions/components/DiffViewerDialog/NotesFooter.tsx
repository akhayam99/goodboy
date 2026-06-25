import { Sparkles } from 'lucide-react'
import { cn, Divider } from '@goodboy/ui'

type Props = {
  openCount: number
  spawning: boolean
  onPropose: () => void
}

export const NotesFooter = ({ openCount, spawning, onPropose }: Props) => {
  return (
    <>
      <Divider className="shrink-0" />
      <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/20 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {openCount} open {openCount === 1 ? 'note' : 'notes'} · spawn a reviewer to propose fixes
        </span>
        <button
          type="button"
          onClick={onPropose}
          disabled={spawning}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50',
            spawning && 'animate-border-pulse',
          )}
          title="spawn a reviewer agent that proposes fixes without touching code"
        >
          <Sparkles size={11} aria-hidden />
          Propose fixes
        </button>
      </div>
    </>
  )
}

import { cn } from '@goodboy/ui'

type CommentSnippetProps = {
  readonly author?: string | null
  readonly location?: string | null
  readonly body?: string | null
  readonly className?: string
}

export const CommentSnippet = ({ author, location, body, className }: CommentSnippetProps) => {
  const who = author?.trim() || 'reviewer'
  const where = location?.trim() || 'conversation'
  const text = body?.trim() ?? ''
  return (
    <div className={cn('flex flex-col gap-0.5 text-2xs', className)}>
      <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground/70">
        <span className="truncate font-medium text-foreground/70">{who}</span>
        <span aria-hidden className="text-muted-foreground/40">
          ·
        </span>
        <span className="truncate font-mono tabular-nums text-muted-foreground/60">{where}</span>
      </div>
      {text ? <p className="line-clamp-2 leading-snug text-muted-foreground/80">{text}</p> : null}
    </div>
  )
}

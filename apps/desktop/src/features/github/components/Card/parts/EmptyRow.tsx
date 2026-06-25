import { ExternalLink } from 'lucide-react'

type Props = {
  readonly text: string
  readonly actionUrl: string
  readonly actionLabel: string
  readonly onOpenUrl: (url: string) => void
}

export const EmptyRow = ({ text, actionUrl, actionLabel, onOpenUrl }: Props) => {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span>{text}</span>
      <button
        type="button"
        onClick={() => onOpenUrl(actionUrl)}
        className="inline-flex items-center gap-0.5 hover:text-foreground"
        title={actionLabel}
      >
        <ExternalLink size={9} aria-hidden />
      </button>
    </div>
  )
}

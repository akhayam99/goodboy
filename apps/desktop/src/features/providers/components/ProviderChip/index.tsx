import type { ReactNode } from 'react'
import { cn } from '@goodboy/ui'
import type { ProviderId } from '@goodboy/types'
import { PROVIDER_LABEL } from '../../../chat/utils/chat-constants'
import { PROVIDER_BRAND, brandColor } from '../provider-brand'

type ProviderChipProps = {
  readonly id: ProviderId
  readonly selected: boolean
  readonly disabled: boolean
  readonly onClick: () => void
  readonly trailing?: ReactNode
  readonly title?: string
}

export const ProviderChip = ({
  id,
  selected,
  disabled,
  onClick,
  trailing,
  title,
}: ProviderChipProps) => {
  const Icon = PROVIDER_BRAND[id].icon
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs motion-safe:transition-colors',
        selected
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <Icon size={13} aria-hidden style={{ color: brandColor(id) }} />
      {PROVIDER_LABEL[id]}
      {trailing}
    </button>
  )
}

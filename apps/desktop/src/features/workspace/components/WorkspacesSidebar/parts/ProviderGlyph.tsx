import { cn } from '@goodboy/ui'
import type { ProviderId } from '@goodboy/types'
import {
  PROVIDER_BRAND,
  brandColor,
} from '../../../../../features/providers/components/provider-brand'

type Props = {
  readonly provider: string | null | undefined
  readonly muted?: boolean
}

export const ProviderGlyph = ({ provider, muted }: Props) => {
  if (!provider || !(provider in PROVIDER_BRAND)) {
    return null
  }
  const id = provider as ProviderId
  const Icon = PROVIDER_BRAND[id].icon
  return (
    <Icon
      size={11}
      aria-hidden
      className={cn('shrink-0', muted && 'opacity-40')}
      style={{ color: brandColor(id) }}
    />
  )
}

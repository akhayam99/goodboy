import { PROVIDER_BRAND, brandColor } from '../../../providers/components/provider-brand'
import { providerLabel, toProviderId } from './lib'

type Props = {
  readonly provider: string
  readonly size?: number
  readonly withChip?: boolean
}

export const ProviderIcon = ({ provider, size = 14, withChip = false }: Props) => {
  const id = toProviderId(provider)
  if (!id) {
    return <span className="text-2xs text-muted-foreground">{providerLabel(provider)}</span>
  }
  const Icon = PROVIDER_BRAND[id].icon
  const color = brandColor(id)

  if (!withChip) {
    return <Icon size={size} aria-label={providerLabel(provider)} style={{ color }} />
  }

  return (
    <span
      className="flex items-center justify-center rounded"
      style={{
        width: size + 8,
        height: size + 8,
        backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
        color,
      }}
    >
      <Icon size={size} aria-label={providerLabel(provider)} />
    </span>
  )
}

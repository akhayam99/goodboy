import { StatusDot, type Tone } from '@goodboy/ui'
import type { ProviderLifecyclePhase } from '../../../../store/slices/providers'
import type { ProviderConnectionState } from '../../../../features/providers/providers'

type Props = {
  readonly phase: ProviderLifecyclePhase
  readonly connection: ProviderConnectionState
}

type PillSpec = {
  readonly label: string
  readonly tone: Tone
  readonly pulsing?: boolean
  readonly dotClassName?: string
  readonly labelClass: string
}

function specFor(phase: ProviderLifecyclePhase, connection: ProviderConnectionState): PillSpec {
  switch (phase) {
    case 'installing':
      return { label: 'Installing', tone: 'primary', pulsing: true, labelClass: 'text-primary' }
    case 'connecting':
      return { label: 'Signing in', tone: 'primary', pulsing: true, labelClass: 'text-primary' }
    case 'disconnecting':
      return {
        label: 'Signing out',
        tone: 'neutral',
        pulsing: true,
        labelClass: 'text-muted-foreground',
      }
    case 'installed':
      return { label: 'Ready to connect', tone: 'warning', labelClass: 'text-warning' }
    case 'cancelled':
      return {
        label: 'Cancelled',
        tone: 'neutral',
        dotClassName: 'bg-muted-foreground/60',
        labelClass: 'text-muted-foreground',
      }
    case 'error':
      return { label: 'Error', tone: 'danger', labelClass: 'text-danger' }
    case 'connected':
      return { label: 'Connected', tone: 'primary', labelClass: 'text-primary' }
    case 'idle':
    default:
      return connectionSpec(connection)
  }
}

function connectionSpec(connection: ProviderConnectionState): PillSpec {
  switch (connection) {
    case 'connected':
      return { label: 'Connected', tone: 'primary', labelClass: 'text-primary' }
    case 'installed_disconnected':
      return { label: 'Not signed in', tone: 'warning', labelClass: 'text-warning' }
    case 'missing':
      return {
        label: 'Not installed',
        tone: 'neutral',
        dotClassName: 'bg-muted-foreground/40',
        labelClass: 'text-muted-foreground',
      }
    case 'error':
      return { label: 'Error', tone: 'danger', labelClass: 'text-danger' }
  }
}

export const StatusPill = ({ phase, connection }: Props) => {
  const spec = specFor(phase, connection)
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-medium">
      <StatusDot tone={spec.tone} size="sm" pulsing={spec.pulsing} className={spec.dotClassName} />
      <span className={spec.labelClass}>{spec.label}</span>
    </span>
  )
}

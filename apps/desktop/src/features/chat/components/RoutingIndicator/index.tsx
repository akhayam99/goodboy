import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type {
  ProviderId,
  RoutingDecision,
  SessionProviderPreference,
  TurnProviderOverride,
} from '@goodboy/types'
import { resolveProviderForTurn } from '../../../../features/providers/routing'
import { SESSION_FEATURES } from '../../../../shared/lib/features'

type Props = {
  readonly sessionPreference: SessionProviderPreference
  readonly turnOverride: TurnProviderOverride | undefined
  readonly connectedProviders: ReadonlyArray<ProviderId>
  readonly onSendAnyway?: () => void
}

export const RoutingIndicator = ({
  sessionPreference,
  turnOverride,
  connectedProviders,
  onSendAnyway,
}: Props) => {
  const [decision, setDecision] = useState<RoutingDecision | null>(null)

  useEffect(() => {
    let cancelled = false
    resolveProviderForTurn(sessionPreference, turnOverride, [...connectedProviders]).then((d) => {
      if (!cancelled) {
        setDecision(d)
      }
    })
    return () => {
      cancelled = true
    }
  }, [sessionPreference, turnOverride, connectedProviders])

  if (!decision) {
    return null
  }
  if (!SESSION_FEATURES.budget) {
    return null
  }

  if (decision.reason === 'all-exceeded') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-xs text-danger">
        <AlertTriangle size={13} aria-hidden className="shrink-0" />
        <span className="flex-1">all provider budgets exceeded</span>
        {onSendAnyway ? (
          <button
            type="button"
            onClick={onSendAnyway}
            className="shrink-0 rounded border border-danger/30 px-2 py-0.5 font-medium text-danger transition-colors hover:bg-danger/10"
          >
            send anyway
          </button>
        ) : null}
      </div>
    )
  }

  const isFallback =
    decision.reason === 'fallback-budget' || decision.reason === 'fallback-disconnected'
  if (!isFallback || !decision.fallbackFrom) {
    return null
  }

  const label = decision.selectedProvider === 'anthropic' ? 'claude' : decision.selectedProvider
  const fromLabel = decision.fallbackFrom === 'anthropic' ? 'claude' : decision.fallbackFrom
  const cause =
    decision.reason === 'fallback-budget'
      ? `budget exceeded for ${fromLabel}`
      : `${fromLabel} disconnected`

  return (
    <div className="flex w-fit items-center gap-1.5 rounded-md border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-xs text-warning">
      <AlertTriangle size={13} aria-hidden className="shrink-0" />
      <span>
        fallback: {label} / {decision.selectedModel} ({cause})
      </span>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { StatusDot, cn } from '@goodboy/ui'
import type { SessionId, TelemetryRecord } from '@goodboy/types'
import { EMPTY_ARRAY, useAppStore, useSummarizerStatus } from '../../../../store'

export const SummarizerBadge = ({ sessionId }: { sessionId: SessionId }) => {
  const { status, lastUpdate, error, lastAttempt } = useSummarizerStatus(sessionId)
  const canRetry = lastAttempt !== null
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  )
  const retrySummarizer = useAppStore((s) => s.retrySummarizer)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (status !== 'error') setRetrying(false)
  }, [status])

  const totals = useMemo(() => {
    let inputTokens = 0
    let outputTokens = 0
    let estimatedCostUsd = 0
    let count = 0
    for (const rec of telemetry) {
      if (rec.kind !== 'summarizer') continue
      inputTokens += rec.inputTokens
      outputTokens += rec.outputTokens
      estimatedCostUsd += rec.estimatedCostUsd
      count += 1
    }
    return { inputTokens, outputTokens, estimatedCostUsd, count }
  }, [telemetry])

  const costTooltip =
    totals.count === 0
      ? 'summarizer has not run yet'
      : `summary total · ${totals.count} run${totals.count === 1 ? '' : 's'} · ${totals.inputTokens} in / ${totals.outputTokens} out · $${totals.estimatedCostUsd.toFixed(4)}${lastUpdate ? ` · last ${lastUpdate}` : ''}`

  const costPill = (
    <span
      title={costTooltip}
      className="rounded-full bg-subtle px-2 py-0.5 text-2xs text-muted-foreground"
    >
      Σ ${totals.estimatedCostUsd.toFixed(4)}
    </span>
  )

  if (status === 'running') {
    return (
      <span className="flex items-center gap-1">
        <StatusDot tone="info" size="sm" pulsing />
        {costPill}
      </span>
    )
  }

  if (status === 'error') {
    const errorTitle = error ? `cannot summarize · ${error}` : 'cannot summarize'
    return (
      <span className="flex items-center gap-1">
        {costPill}
        <button
          type="button"
          onClick={() => {
            if (!canRetry || retrying) return
            setRetrying(true)
            retrySummarizer(sessionId)
          }}
          disabled={!canRetry}
          title={canRetry ? `${errorTitle}, click to retry` : errorTitle}
          aria-label={canRetry ? 'retry summarizer' : 'summarizer failed'}
          className={cn(
            'inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-2xs uppercase tracking-wide text-danger transition-colors',
            retrying && 'animate-border-pulse',
            canRetry
              ? 'hover:bg-danger/15 hover:text-danger-foreground/90'
              : 'cursor-not-allowed opacity-70',
          )}
        >
          <AlertTriangle size={10} aria-hidden />
          Cannot summarize
          <RotateCw size={10} aria-hidden className="shrink-0" />
        </button>
      </span>
    )
  }

  if (status === 'idle') return totals.count > 0 ? costPill : null

  return null
}

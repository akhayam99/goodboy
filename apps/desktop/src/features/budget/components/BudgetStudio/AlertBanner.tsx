import { formatUsd } from '@goodboy/ui'
import { TriangleAlert, X } from 'lucide-react'
import type { BudgetAlert } from '@goodboy/types'
import { providerLabel } from './lib'

type Props = {
  readonly alerts: ReadonlyArray<BudgetAlert>
  readonly onDismiss: (id: string) => void
}

function alertMessage(alert: BudgetAlert): string {
  const who = alert.provider ? providerLabel(alert.provider) : 'this session'
  const usage = `${formatUsd(alert.currentUsd)} of ${formatUsd(alert.capUsd)}`
  switch (alert.kind) {
    case 'provider-exceeded':
    case 'session-exceeded':
      return `${who} exceeded its cap (${usage})`
    case 'provider-threshold':
    case 'session-threshold':
      return `${who} is nearing its cap (${usage})`
  }
}

export const AlertBanner = ({ alerts, onDismiss }: Props) => {
  const active = alerts.filter((a) => !a.dismissedAt)
  if (active.length === 0) {
    return null
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {active.map((alert) => {
        const exceeded = alert.kind === 'provider-exceeded' || alert.kind === 'session-exceeded'
        return (
          <li
            key={alert.id}
            className={
              exceeded
                ? 'flex items-center gap-2.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2'
                : 'flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2'
            }
          >
            <TriangleAlert
              size={14}
              aria-hidden
              className={exceeded ? 'shrink-0 text-danger' : 'shrink-0 text-warning'}
            />
            <span className="flex-1 text-xs text-foreground">{alertMessage(alert)}</span>
            <button
              type="button"
              onClick={() => onDismiss(alert.id)}
              aria-label="dismiss alert"
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <X size={13} aria-hidden />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

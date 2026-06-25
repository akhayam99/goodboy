import type { ProviderTelemetrySummary } from '@goodboy/db'

export type { SetFn, GetFn } from '../../slice-types'

export type ProviderSpendEntry = {
  readonly provider: ProviderTelemetrySummary['provider']
  readonly spentUsd: number
  readonly capUsd: number | null
  readonly pct: number
}

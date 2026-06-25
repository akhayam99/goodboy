import type { IsoDateTime } from './ids'

export type TelemetrySummary = Readonly<{
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  recordCount: number
}>

export type TelemetryPeriodSummary = TelemetrySummary &
  Readonly<{
    periodStart: IsoDateTime
    periodEnd: IsoDateTime
  }>

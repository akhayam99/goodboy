import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types'

export type { SetFn, GetFn } from '../../slice-types'

export type ProviderLifecyclePhase =
  | 'idle'
  | 'installing'
  | 'installed'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error'
  | 'cancelled'

export type ProviderLifecycleState = {
  readonly phase: ProviderLifecyclePhase
  readonly runId: string | null
  readonly action: ProviderLifecycleAction | null
  readonly command: string | null
  readonly exitCode: number | null
  readonly startedAt: number | null
  readonly errorTail: string | null
  readonly detectedAuthUrl: string | null
}

export const IDLE_LIFECYCLE: ProviderLifecycleState = {
  phase: 'idle',
  runId: null,
  action: null,
  command: null,
  exitCode: null,
  startedAt: null,
  errorTail: null,
  detectedAuthUrl: null,
}

export type ProviderLifecycleMap = Readonly<Record<ProviderId, ProviderLifecycleState>>

export const INITIAL_LIFECYCLE_MAP: ProviderLifecycleMap = {
  anthropic: IDLE_LIFECYCLE,
  cursor: IDLE_LIFECYCLE,
  codex: IDLE_LIFECYCLE,
  gemini: IDLE_LIFECYCLE,
}

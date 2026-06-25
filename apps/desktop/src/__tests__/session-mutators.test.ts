import { describe, expect, it } from 'vitest'
import type { IsoDateTime, ProviderRunId, TurnState } from '@goodboy/types'
import { deriveSessionState } from '../store/session-mutators'

const now = '2026-05-07T00:00:00.000Z' as IsoDateTime
const earlier = '2026-05-07T00:00:01.000Z' as IsoDateTime
const later = '2026-05-07T00:00:02.000Z' as IsoDateTime

const idle: TurnState = { kind: 'idle', lastActivityAt: now }
const errored: TurnState = { kind: 'error', message: 'boom', failedAt: now }
const starting: TurnState = { kind: 'starting', startedAt: now }
const runA: TurnState = { kind: 'running', runId: 'run_a' as ProviderRunId, startedAt: earlier }
const runB: TurnState = { kind: 'running', runId: 'run_b' as ProviderRunId, startedAt: later }

describe('deriveSessionState', () => {
  it('empty → idle', () => {
    expect(deriveSessionState([], now)).toEqual({ kind: 'idle', lastActivityAt: now })
  })

  it('all idle → idle', () => {
    expect(deriveSessionState([idle, idle], now)).toEqual({ kind: 'idle', lastActivityAt: now })
  })

  it('any running → running (precedence over error/idle)', () => {
    expect(deriveSessionState([idle, errored, runA], now)).toMatchObject({ kind: 'running' })
  })

  it('multiple running → representative is the latest-started run', () => {
    expect(deriveSessionState([runA, runB], now)).toMatchObject({
      kind: 'running',
      runId: 'run_b',
    })
    expect(deriveSessionState([runB, runA], now)).toMatchObject({
      kind: 'running',
      runId: 'run_b',
    })
  })

  it('starting outranks error when nothing is running', () => {
    expect(deriveSessionState([errored, starting], now)).toEqual(starting)
  })

  it('error only when no agent is running or starting', () => {
    expect(deriveSessionState([idle, errored], now)).toEqual(errored)
  })
})

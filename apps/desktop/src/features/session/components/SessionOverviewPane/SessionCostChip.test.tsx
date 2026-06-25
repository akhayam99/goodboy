// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionId, TelemetryRecord } from '@goodboy/types'

const { state } = vi.hoisted(() => ({
  state: { sessionTelemetry: {} as Record<string, ReadonlyArray<TelemetryRecord>> },
}))

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}))

import { SessionCostChip } from './SessionCostChip'

const rec = (kind: string, cost: number): TelemetryRecord =>
  ({ kind, estimatedCostUsd: cost }) as unknown as TelemetryRecord

const SID = 'sess-1' as SessionId

beforeEach(() => {
  state.sessionTelemetry = {}
})
afterEach(cleanup)

describe('SessionCostChip', () => {
  it('shows $0 when there is no telemetry', () => {
    render(<SessionCostChip sessionId={SID} />)
    expect(screen.getByRole('button').textContent).toBe('$0')
  })

  it('sums turn costs and excludes summarizer records', () => {
    state.sessionTelemetry = {
      [SID]: [rec('turn', 1.5), rec('summarizer', 9.99), rec('turn', 0.25)],
    }
    render(<SessionCostChip sessionId={SID} />)
    expect(screen.getByRole('button').textContent).toBe('$1.75')
  })

  it('dispatches the budget-studio event scoped to the session on click', () => {
    const handler = vi.fn()
    window.addEventListener('goodboy:open-budget-studio', handler)
    render(<SessionCostChip sessionId={SID} />)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
    const evt = handler.mock.calls[0]![0] as CustomEvent
    expect(evt.detail).toEqual({ scope: { kind: 'session', sessionId: SID } })
    window.removeEventListener('goodboy:open-budget-studio', handler)
  })
})

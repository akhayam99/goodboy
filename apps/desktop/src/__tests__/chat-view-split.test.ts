import { describe, expect, it } from 'vitest'
import type { ProviderRunId, TurnEvent, IsoDateTime } from '@goodboy/types'
import { detectParallelRunIds, filterEventsByRunId } from '../features/chat/utils/transcript-items'

const AT = '2026-01-01T00:00:00.000Z' as IsoDateTime

function makeEvent(runId: string, delta = 'text'): TurnEvent {
  return { kind: 'assistant_text', runId: runId as ProviderRunId, delta, at: AT }
}

describe('detectParallelRunIds', () => {
  it('returns [] when events is empty', () => {
    expect(detectParallelRunIds([])).toEqual([])
  })

  it('returns [] when all events share one runId', () => {
    const events = [makeEvent('run-a'), makeEvent('run-a'), makeEvent('run-a')]
    expect(detectParallelRunIds(events)).toEqual([])
  })

  it('returns [] when only history events exist (loaded messages)', () => {
    const events = [makeEvent('history'), makeEvent('history')]
    expect(detectParallelRunIds(events)).toEqual([])
  })

  it('returns [] when history + one real runId → single column', () => {
    const events = [makeEvent('history'), makeEvent('run-a')]
    expect(detectParallelRunIds(events)).toEqual([])
  })

  it('returns 2 ids when two distinct runIds present → split view', () => {
    const events = [makeEvent('run-a'), makeEvent('run-b'), makeEvent('run-a')]
    const ids = detectParallelRunIds(events)
    expect(ids).toHaveLength(2)
    expect(ids).toContain('run-a')
    expect(ids).toContain('run-b')
  })

  it('returns 3 ids for a 3-run parallel group', () => {
    const events = [
      makeEvent('run-a'),
      makeEvent('run-b'),
      makeEvent('run-c'),
      makeEvent('run-a'),
      makeEvent('run-c'),
    ]
    const ids = detectParallelRunIds(events)
    expect(ids).toHaveLength(3)
  })

  it('excludes history but includes real runIds when both present', () => {
    const events = [makeEvent('history'), makeEvent('run-x'), makeEvent('run-y')]
    const ids = detectParallelRunIds(events)
    expect(ids).toHaveLength(2)
    expect(ids).not.toContain('history')
  })
})

describe('filterEventsByRunId', () => {
  it('returns only events matching the given runId', () => {
    const events = [
      makeEvent('run-a', 'hello'),
      makeEvent('run-b', 'world'),
      makeEvent('run-a', '!'),
    ]
    const filtered = filterEventsByRunId(events, 'run-a' as ProviderRunId)
    expect(filtered).toHaveLength(2)
    for (const e of filtered) {
      expect(e.runId).toBe('run-a')
    }
  })

  it('returns empty array when no events match', () => {
    const events = [makeEvent('run-b')]
    expect(filterEventsByRunId(events, 'run-a' as ProviderRunId)).toEqual([])
  })

  it('returns all events when all share the same runId', () => {
    const events = [makeEvent('run-a'), makeEvent('run-a'), makeEvent('run-a')]
    expect(filterEventsByRunId(events, 'run-a' as ProviderRunId)).toHaveLength(3)
  })
})

describe('isSplitView derivation', () => {
  function isSplitView(flagOn: boolean, events: ReadonlyArray<TurnEvent>): boolean {
    const ids = flagOn ? detectParallelRunIds(events) : []
    return ids.length > 1
  }

  it('flag off → never split-view, even with parallel events', () => {
    const events = [makeEvent('run-a'), makeEvent('run-b'), makeEvent('run-c')]
    expect(isSplitView(false, events)).toBe(false)
  })

  it('flag on, no parallel group → single column', () => {
    const events = [makeEvent('run-a'), makeEvent('run-a')]
    expect(isSplitView(true, events)).toBe(false)
  })

  it('flag on, 2 parallel runIds → split view', () => {
    const events = [makeEvent('run-a'), makeEvent('run-b')]
    expect(isSplitView(true, events)).toBe(true)
  })

  it('flag on, 3 parallel runIds → split view with 3 columns', () => {
    const events = [makeEvent('run-a'), makeEvent('run-b'), makeEvent('run-c')]
    const ids = detectParallelRunIds(events)
    expect(isSplitView(true, events)).toBe(true)
    expect(ids).toHaveLength(3)
  })

  it('flag on, 4 parallel runIds → 4 columns', () => {
    const events = [makeEvent('run-a'), makeEvent('run-b'), makeEvent('run-c'), makeEvent('run-d')]
    const ids = detectParallelRunIds(events)
    expect(ids).toHaveLength(4)
    expect(isSplitView(true, events)).toBe(true)
  })
})

describe('per-column event isolation', () => {
  it('each column sees only its own events', () => {
    const events = [
      makeEvent('run-a', 'a1'),
      makeEvent('run-b', 'b1'),
      makeEvent('run-a', 'a2'),
      makeEvent('run-b', 'b2'),
      makeEvent('run-c', 'c1'),
    ]
    const ids = detectParallelRunIds(events)
    expect(ids).toHaveLength(3)

    for (const id of ids) {
      const col = filterEventsByRunId(events, id)
      for (const e of col) {
        expect(e.runId).toBe(id)
      }
    }

    const total = ids.reduce((sum, id) => sum + filterEventsByRunId(events, id).length, 0)
    expect(total).toBe(events.length)
  })
})

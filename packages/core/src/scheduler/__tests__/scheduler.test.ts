import { describe, expect, it, vi } from 'vitest'
import type {
  IsoDateTime,
  ParallelGroup,
  ParallelGroupId,
  ParallelAgent,
  ParallelAgentId,
  StepId,
  AgentStatus,
  ProviderRunId,
  TurnEvent,
} from '@goodboy/types'
import {
  awaitMerge,
  cancelGroup,
  fanOut,
  onProgress,
  type MergeResult,
  type SchedulerDeps,
  type SchedulerProgress,
} from '../index'

const NOW = '2025-01-01T00:00:00.000Z' as IsoDateTime

function makeGroup(overrides?: Partial<ParallelGroup>): ParallelGroup {
  return {
    id: 'g1' as ParallelGroupId,
    sessionId: 's1' as ParallelGroup['sessionId'],
    ordinal: 1,
    mergeStrategy: 'last_write_wins',
    createdAt: NOW,
    completedAt: null,
    ...overrides,
  }
}

function makeRun(index: number, runId: string = `run-${index}`): ParallelAgent {
  return {
    id: `pr-${index}` as ParallelAgentId,
    groupId: 'g1' as ParallelGroupId,
    stepId: `pd-${index}` as StepId,
    parallelIndex: index,
    runId: runId as ProviderRunId,
    status: 'pending' as AgentStatus,
    worktreePath: `/tmp/wt-${index}`,
    outputSummary: null,
    startedAt: NOW,
    completedAt: null,
  }
}

function makeDoneTurnEvent(runId: string): TurnEvent {
  return { kind: 'done', runId: runId as ProviderRunId, at: NOW }
}

describe('fanOut + awaitMerge, 3-run happy path', () => {
  it('returns MergeResult with completed status for all runs', async () => {
    const runs = [makeRun(0), makeRun(1), makeRun(2)]
    const group = makeGroup()

    const spawnRun = vi.fn(async (run: ParallelAgent) => ({
      status: 'completed' as AgentStatus,
      outputSummary: `summary-${run.parallelIndex}`,
    }))

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() }
    const handle = fanOut(deps, group, runs)
    const result = await awaitMerge(handle)

    expect(result.groupId).toBe('g1')
    expect(result.mergeStrategy).toBe('last_write_wins')
    expect(result.runStatuses).toHaveLength(3)

    for (let i = 0; i < 3; i++) {
      expect(result.runStatuses[i]?.status).toBe('completed')
      expect(result.runStatuses[i]?.outputSummary).toBe(`summary-${i}`)
      expect(result.runStatuses[i]?.error).toBeUndefined()
    }

    expect(spawnRun).toHaveBeenCalledTimes(3)
  })
})

describe('fanOut + awaitMerge, partial failure', () => {
  it('includes failed run in result without cancelling siblings', async () => {
    const runs = [makeRun(0, 'run-0'), makeRun(1, 'run-1'), makeRun(2, 'run-2')]
    const group = makeGroup()

    const spawnRun = vi.fn(async (run: ParallelAgent) => {
      if (run.parallelIndex === 1) {
        return { status: 'failed' as AgentStatus, outputSummary: null, error: 'timeout' }
      }
      return { status: 'completed' as AgentStatus, outputSummary: `ok-${run.parallelIndex}` }
    })

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() }
    const handle = fanOut(deps, group, runs)
    const result = await awaitMerge(handle)

    expect(result.runStatuses).toHaveLength(3)

    const failed = result.runStatuses.find((r) => r.runId === ('run-1' as ProviderRunId))
    expect(failed?.status).toBe('failed')
    expect(failed?.error).toBe('timeout')

    const completed = result.runStatuses.filter((r) => r.status === 'completed')
    expect(completed).toHaveLength(2)

    expect(deps.cancelRun).not.toHaveBeenCalled()
    expect(spawnRun).toHaveBeenCalledTimes(3)
  })
})

describe('fanOut + awaitMerge, all fail', () => {
  it('returns MergeResult with all runs failed', async () => {
    const runs = [makeRun(0), makeRun(1)]
    const group = makeGroup({ mergeStrategy: 'manual' })

    const spawnRun = vi.fn(async () => ({
      status: 'failed' as AgentStatus,
      outputSummary: null,
      error: 'provider down',
    }))

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() }
    const handle = fanOut(deps, group, runs)
    const result = await awaitMerge(handle)

    expect(result.mergeStrategy).toBe('manual')
    expect(result.runStatuses.every((r) => r.status === 'failed')).toBe(true)
    expect(result.runStatuses.every((r) => r.error === 'provider down')).toBe(true)
  })
})

describe('fanOut + awaitMerge, unexpected rejection', () => {
  it('treats thrown error as failed run', async () => {
    const runs = [makeRun(0, 'run-0')]
    const group = makeGroup()

    const spawnRun = vi.fn(async () => {
      throw new Error('crash')
    })

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() }
    const handle = fanOut(deps, group, runs)
    const result = await awaitMerge(handle)

    expect(result.runStatuses[0]?.status).toBe('failed')
    expect(result.runStatuses[0]?.error).toBe('crash')
  })
})

describe('cancelGroup', () => {
  it('calls cancelRun for every run in the handle', async () => {
    const runs = [makeRun(0, 'run-0'), makeRun(1, 'run-1'), makeRun(2, 'run-2')]
    const group = makeGroup()

    const spawnRun = vi.fn(() => new Promise<never>(() => undefined))
    const cancelRun = vi.fn(async () => undefined)

    const deps: SchedulerDeps = { spawnRun, cancelRun }
    const handle = fanOut(deps, group, runs)

    await cancelGroup(handle)

    expect(cancelRun).toHaveBeenCalledTimes(3)
    expect(cancelRun).toHaveBeenCalledWith('run-0' as ProviderRunId)
    expect(cancelRun).toHaveBeenCalledWith('run-1' as ProviderRunId)
    expect(cancelRun).toHaveBeenCalledWith('run-2' as ProviderRunId)
  })
})

describe('onProgress', () => {
  it('delivers events with correct runId to subscriber', async () => {
    const runs = [makeRun(0, 'run-0'), makeRun(1, 'run-1')]
    const group = makeGroup()

    const spawnRun = vi.fn((run: ParallelAgent, onEvent: (e: TurnEvent) => void) => {
      return Promise.resolve().then(() => {
        onEvent(makeDoneTurnEvent(run.runId))
        return { status: 'completed' as AgentStatus, outputSummary: null }
      })
    })

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() }
    const handle = fanOut(deps, group, runs)

    const received: SchedulerProgress[] = []
    onProgress(handle, (p) => received.push(p))

    await awaitMerge(handle)

    expect(received).toHaveLength(2)
    const runIds = received.map((p) => p.runId)
    expect(runIds).toContain('run-0' as ProviderRunId)
    expect(runIds).toContain('run-1' as ProviderRunId)
    received.forEach((p) => expect(p.event.kind).toBe('done'))
  })

  it('unsubscribe stops delivery', async () => {
    const runs = [makeRun(0, 'run-0')]
    const group = makeGroup()

    let resolveSpawn!: (v: { status: AgentStatus; outputSummary: null }) => void
    const spawnRun = vi.fn((_run: ParallelAgent, onEvent: (e: TurnEvent) => void) => {
      return new Promise<{ status: AgentStatus; outputSummary: null }>((res) => {
        resolveSpawn = res
        onEvent(makeDoneTurnEvent('run-0'))
      })
    })

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() }
    const handle = fanOut(deps, group, runs)

    const received: SchedulerProgress[] = []
    const unsub = onProgress(handle, (p) => received.push(p))
    unsub()

    resolveSpawn({ status: 'completed', outputSummary: null })
    await awaitMerge(handle)

    expect(received).toHaveLength(0)
  })
})
